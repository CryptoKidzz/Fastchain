const chalk = require('chalk').default;
const axios = require('axios');
const fs = require('fs');
const banner = require('./config/banner');

const BASE_URL = 'https://api.fastchain.org/v2/check-in';
const INFO_URL = 'https://api.fastchain.org/v2/myinfo';
const DRAW_URL = 'https://api.fastchain.org/v2/draw';

function getBearerTokens() {
    try {
        const tokens = fs.readFileSync('data.txt', 'utf8')
            .split('\n')
            .map(t => t.trim())
            .filter(Boolean);
        
        if (tokens.length > 0) {
            console.log(chalk.green(`\n🔑 Found ${tokens.length} tokens`));
            return tokens;
        } else {
            console.log(chalk.red('❌ No tokens found in data.txt'));
        }
    } catch (error) {
        console.log(chalk.red('❌ Error reading data.txt'), error.message);
    }
    return [];
}

function convertToWIB(isoString) {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return new Intl.DateTimeFormat('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Jakarta'
        }).format(date);
    } catch (error) {
        return 'Invalid Date';
    }
}

function getWaitTime(lastCheckIn) {
    if (!lastCheckIn) return 0;
    const lastCheckDate = new Date(lastCheckIn);
    const nextCheckDate = new Date(lastCheckDate.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();
    return nextCheckDate - now > 0 ? nextCheckDate - now : 0;
}

async function getUserInfo(headers) {
    try {
        const response = await axios.get(INFO_URL, { headers });
        return response.data.data;
    } catch (error) {
        console.log(chalk.red('❌ Error getting user info'), error.message);
        return null;
    }
}

async function checkIn(headers) {
    try {
        await axios.post(BASE_URL, null, { headers });
        console.log(chalk.green('✅ Check-in successful!'));
        return true;
    } catch (error) {
        console.log(chalk.red('❌ Error checking in'), error.message);
        return false;
    }
}

async function drawPoints(headers, draws) {
    let totalEarned = 0;
    for (let i = 1; i <= draws; i++) {
        try {
            const res = await axios.post(DRAW_URL, null, { headers });
            const earned = res.data?.data?.point || 0;
            totalEarned += earned;
            console.log(chalk.magenta(`🎯 Draw ${i}: Earned ${earned} points`));
            await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (err) {
            console.log(chalk.red(`❌ Failed on draw ${i}: ${err.message}`));
        }
    }

    // Fetch updated point info
    try {
        const updatedInfo = await getUserInfo(headers);
        const updatedPoints = updatedInfo?.points ?? 'N/A';
        console.log(chalk.green(`✅ Draw finished. Total earned: ${totalEarned} points`));
        console.log(chalk.green(`💰 Total points after draw: ${updatedPoints}`));
    } catch (err) {
        console.log(chalk.red('❌ Failed to get updated points after draw'));
    }
}

async function processAccount(token, index) {
    console.log(chalk.yellow(`\n⚙️  Processing akun ${index + 1}`));

    const headers = { Authorization: `Bearer ${token}` };
    const userInfo = await getUserInfo(headers);

    if (!userInfo) {
        console.log(chalk.red('❌ Failed to get account information'));
        return null;
    }

    const lastCheckInWIB = convertToWIB(userInfo.lastCheckIn);
    const nextCheckInWIB = convertToWIB(new Date(new Date(userInfo.lastCheckIn).getTime() + 24 * 60 * 60 * 1000));
    const currentDraws = userInfo.currentDraws || 0;
    const totalPoints = userInfo.points ?? 'N/A';

    console.log(chalk.blue(`📅 Last check-in : ${lastCheckInWIB}`));
    console.log(chalk.blue(`⏭️ Next check-in : ${nextCheckInWIB}`));

    if (currentDraws > 0) {
        console.log(chalk.yellow(`🎁 You have ${currentDraws} draw(s) before check-in`));
        await drawPoints(headers, currentDraws);
    } else {
        console.log(chalk.gray('🎁 No draws available'));
    }

    const waitTime = getWaitTime(userInfo.lastCheckIn);

    if (waitTime === 0) {
        console.log(chalk.cyan('🕐 Time to check-in!'));
        await checkIn(headers);

        const updatedInfo = await getUserInfo(headers);
        const newPoints = updatedInfo?.points ?? 'N/A';
        console.log(chalk.green(`💰 Total points after check-in: ${newPoints}`));
    } else {
        console.log(chalk.green(`💰 Total points: ${totalPoints}`));
        console.log(chalk.gray(`⏱️ Not time for check-in yet`));
    }

    return waitTime;
}

async function autoCheckIn() {
    while (true) {
        console.log(chalk.cyan('\n🚀 Starting check-in process...'));
        const tokens = getBearerTokens();
        if (tokens.length === 0) return;

        let minWaitTime = 24 * 60 * 60 * 1000;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const waitTime = await processAccount(token, i);
            minWaitTime = Math.min(minWaitTime, waitTime);
            console.log(chalk.grey('-----------------------'));
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.log(chalk.green('\n✅ All accounts have been processed.'));
        console.log(chalk.magenta(`⏳ Waiting ${Math.round(minWaitTime / 60000)} minutes for the next check-in...`));
        await new Promise(res => setTimeout(res, minWaitTime));
    }
}

autoCheckIn();
