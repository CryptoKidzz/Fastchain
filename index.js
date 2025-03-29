const chalk = require('chalk').default;
const axios = require('axios');
const banner = require('./config/banner')
const fs = require('fs');

const BASE_URL = 'https://api.fastchain.org/v2/check-in';
const INFO_URL = 'https://api.fastchain.org/v2/myinfo';

function getBearerTokens() {
    try {
        const tokens = fs.readFileSync('data.txt', 'utf8').trim().split('\n');
        if (tokens.length) {
            console.log(chalk.green(`Found ${tokens.length}`));
            return tokens;
        }
    } catch (error) {
        console.log(chalk.red('No token found in token.txt'), error.message);
    }
    return [];
}

async function getUserInfo(headers) {
    try {
        const response = await axios.get(INFO_URL, { headers });
        return response.data.data;
    } catch (error) {
        console.log(chalk.red('Error getting user info'), error.message);
        return null;
    }
}

async function checkIn(headers) {
    try {
        await axios.post(BASE_URL, null, { headers });
        console.log(chalk.green('Check-in successful!'));
        return true;
    } catch (error) {
        console.log(chalk.red('Error checking in'), error.message);
        return false;
    }
}

function convertToWIB(isoString) {
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
    const lastCheckDate = new Date(lastCheckIn);
    const nextCheckDate = new Date(lastCheckDate.getTime() + 24 * 60 * 60 * 1000);
    const now = new Date();

    const waitTime = nextCheckDate - now;
    return waitTime > 0 ? waitTime : 0;
}

async function processAccount(token) {
    console.log(chalk.yellow(`Processing account with token: ${token.slice(0, 10)}...`));

    const headers = { Authorization: `Bearer ${token}` };
    const userInfo = await getUserInfo(headers);

    if (!userInfo) {
        console.log(chalk.red('Failed to get account information'));
        return null;
    }

    let lastCheckInWIB = 'N/A';
    let waitTime = 0;

    if (!userInfo.lastCheckIn) {
        // Jika akun belum pernah check-in, langsung lakukan check-in
        console.log(chalk.yellow('No last check-in found. Assuming first-time check-in.'));
        console.log(chalk.green('Checking in now...'));
        await checkIn(headers);
        return 0; // Tidak perlu menunggu
    } else {
        lastCheckInWIB = convertToWIB(userInfo.lastCheckIn);
        waitTime = getWaitTime(userInfo.lastCheckIn);
    }

    console.log(chalk.blue(`Last check-in: ${lastCheckInWIB}`));

    return waitTime;
}

async function autoCheckIn() {
    while (true) {
        console.log(chalk.cyan('Starting check-in process...'));
        const tokens = getBearerTokens();

        let minWaitTime = 24 * 60 * 60 * 1000; // Default 24 jam

        for (const token of tokens) {
            const waitTime = await processAccount(token);
            minWaitTime = Math.min(minWaitTime, waitTime);
            console.log(chalk.grey('-----------------------'));
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        console.log(chalk.green('All accounts have been processed.'));
        console.log(chalk.magenta(`Waiting ${minWaitTime / 1000 / 60} minutes for the next check-in...`));
        await new Promise(resolve => setTimeout(resolve, minWaitTime));
    }
}

autoCheckIn();
