import axios from 'axios';
import cfonts from 'cfonts';
import gradient from 'gradient-string';
import chalk, { chalkStderr } from 'chalk';
import fs from 'fs/promises';
import readline from 'readline';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import ProgressBar from 'progress';
import ora from 'ora';
import boxen from 'boxen';

const logger = {
  info: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || 'ℹ️  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.cyan('INFO');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  warn: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '⚠️ ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.yellow('WARN');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  error: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '❌ ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.red('ERROR');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  },
  debug: (msg, options = {}) => {
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const emoji = options.emoji || '🔍  ';
    const context = options.context ? `[${options.context}] ` : '';
    const level = chalk.magenta('DEBUG');
    const formattedMsg = `[ ${chalk.gray(timestamp)} ] ${emoji}${level} ${chalk.white(context.padEnd(20))}${chalk.white(msg)}`;
    console.log(formattedMsg);
  }
};

function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function stripAnsi(str) {
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

function centerText(text, width) {
  const cleanText = stripAnsi(text);
  const textLength = cleanText.length;
  const totalPadding = Math.max(0, width - textLength);
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;
  return `${' '.repeat(leftPadding)}${text}${' '.repeat(rightPadding)}`;
}

function printHeader(title) {
  const width = 80;
  console.log(gradient.passion(`┬${'─'.repeat(width - 2)}┬`));
  console.log(gradient.passion(`│ ${title.padEnd(width - 4)} │`));
  console.log(gradient.passion(`┴${'─'.repeat(width - 2)}┴`));
}

function printInfo(label, value, context) {
  logger.info(`${label.padEnd(15)}: ${chalk.cyan(value)}`, { emoji: '📍 ', context });
}

function printProfileInfo(email, totalPoints, context) {
  printHeader(`Profile Info ${context}`);
  printInfo('Email', email || 'N/A', context);
  printInfo('Total Points', totalPoints.toString(), context);
  console.log('\n');
}

async function formatTaskTable(tasks, context) {
  console.log('\n');
  logger.info('Task List:', { context, emoji: '📋 ' });
  console.log('\n');

  const spinner = ora('Rendering tasks...').start();
  await new Promise(resolve => setTimeout(resolve, 1000));
  spinner.stop();

  const header = chalk.cyanBright('+----------------------+----------+-------+---------+\n| Task Name            | Freq     | Point | Status  |\n+----------------------+----------+-------+---------+');
  const rows = tasks.map(task => {
    const displayName = task.title && typeof task.title === 'string'
      ? (task.title.length > 20 ? task.title.slice(0, 17) + '...' : task.title)
      : 'Unknown Task';
    const status = task.userQuest !== null ? chalk.greenBright('Complte') : chalk.yellowBright('Pending');
    return `| ${displayName.padEnd(20)} | ${((task.is_daily ? 'DAILY' : 'ONCE') + '     ').slice(0, 8)} | ${((task.reward || 0).toString() + '    ').slice(0, 5)} | ${status.padEnd(6)} |`;
  }).join('\n');
  const footer = chalk.cyanBright('+----------------------+----------+-------+---------+');

  console.log(header + '\n' + rows + '\n' + footer);
  console.log('\n');
}

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/102.0'
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getAxiosConfig(proxy, token = null, bearer = false, additionalHeaders = {}) {
  const headers = {
    'accept': 'application/json, text/plain, */*',
    'accept-encoding': 'gzip, deflate, br',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,id;q=0.7,fr;q=0.6,ru;q=0.5,zh-CN;q=0.4,zh;q=0.3',
    'cache-control': 'no-cache',
    'content-type': 'application/json',
    'origin': 'https://www.neuraknights.gg',
    'pragma': 'no-cache',
    'priority': 'u=1, i',
    'referer': 'https://www.neuraknights.gg/',
    'sec-ch-ua': '"Not;A=Brand";v="99", "Opera";v="123", "Chromium";v="139"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'user-agent': getRandomUserAgent(),
    ...additionalHeaders
  };
  if (token) {
    headers['authorization'] = bearer ? `Bearer ${token}` : `${token}`;
  }
  const config = {
    headers,
    timeout: 60000
  };
  if (proxy) {
    config.httpsAgent = newAgent(proxy);
    config.proxy = false;
  }
  return config;
}

function newAgent(proxy) {
  if (proxy.startsWith('http://') || proxy.startsWith('https://')) {
    return new HttpsProxyAgent(proxy);
  } else if (proxy.startsWith('socks4://') || proxy.startsWith('socks5://')) {
    return new SocksProxyAgent(proxy);
  } else {
    logger.warn(`Unsupported proxy: ${proxy}`);
    return null;
  }
}

async function requestWithRetry(method, url, payload = null, config = {}, retries = 3, backoff = 2000, context) {
  for (let i = 0; i < retries; i++) {
    try {
      let response;
      if (method.toLowerCase() === 'get') {
        response = await axios.get(url, config);
      } else if (method.toLowerCase() === 'post') {
        response = await axios.post(url, payload, config);
      } else {
        throw new Error(`Method ${method} not supported`);
      }
      return response;
    } catch (error) {
      if (error.response && error.response.status >= 500 && i < retries - 1) {
        logger.warn(`Retrying ${method.toUpperCase()} ${url} (${i + 1}/${retries}) due to server error`, { emoji: '🔄', context });
        await delay(backoff / 1000);
        backoff *= 1.5;
        continue;
      }
      if (i < retries - 1) {
        logger.warn(`Retrying ${method.toUpperCase()} ${url} (${i + 1}/${retries})`, { emoji: '🔄', context });
        await delay(backoff / 1000);
        backoff *= 1.5;
        continue;
      }
      throw error;
    }
  }
}

async function readTokens() {
  try {
    const data = await fs.readFile('token.txt', 'utf-8');
    const tokens = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    logger.info(`Loaded ${tokens.length} token${tokens.length === 1 ? '' : 's'}`, { emoji: '🔑 ' });
    return tokens;
  } catch (error) {
    logger.error(`Failed to read token.txt: ${error.message}`, { emoji: '❌ ' });
    return [];
  }
}

async function readProxies() {
  try {
    const data = await fs.readFile('proxy.txt', 'utf-8');
    const proxies = data.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (proxies.length === 0) {
      logger.warn('No proxies found. Proceeding without proxy.', { emoji: '⚠️ ' });
    } else {
      logger.info(`Loaded ${proxies.length} prox${proxies.length === 1 ? 'y' : 'ies'}`, { emoji: '🌐 ' });
    }
    return proxies;
  } catch (error) {
    logger.warn('proxy.txt not found.', { emoji: '⚠️ ' });
    return [];
  }
}

async function fetchProfile(token, proxy, context) {
  const url = 'https://prod-api.novalinkapp.com/api/v1/profile';
  const spinner = ora({ text: 'Fetching profile...', spinner: 'dots' }).start();
  try {
    const config = getAxiosConfig(proxy, token, true);
    const response = await requestWithRetry('get', url, null, config, 3, 2000, context);
    spinner.stop();
    if (response.data.success) {
      const email = response.data.data.authentications[0]?.email || 'N/A';
      const novaLinkUserId = response.data.data.novaLinkUserId || null;
      return { email, novaLinkUserId };
    } else {
      throw new Error('Failed to fetch profile');
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to fetch profile: ${error.message}`));
    return { email: 'N/A', novaLinkUserId: null };
  }
}

async function fetchUserPoints(novaLinkUserId, token, proxy, context) {
  if (!novaLinkUserId) return 'N/A';
  const url = `https://neura-knights-api-prod.anomalygames.ai/api/user?novalink_user_id=${novaLinkUserId}`;
  const spinner = ora({ text: 'Fetching user points...', spinner: 'dots' }).start();
  try {
    const config = getAxiosConfig(proxy, token, true);
    const response = await requestWithRetry('get', url, null, config, 3, 2000, context);
    spinner.stop();
    if (response.data.success) {
      return response.data.data.points || '0';
    } else {
      throw new Error('Failed to fetch user points');
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to fetch user points: ${error.message}`));
    return 'N/A';
  }
}

async function fetchActiveTasks(token, proxy, context) {
  const url = 'https://neura-knights-api-prod.anomalygames.ai/api/quests';
  const spinner = ora({ text: 'Fetching active tasks...', spinner: 'dots' }).start();
  try {
    const config = getAxiosConfig(proxy, token);
    const response = await requestWithRetry('get', url, null, config, 3, 2000, context);
    spinner.stop();
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error('Failed to fetch tasks');
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to fetch active tasks: ${error.message}`));
    return [];
  }
}

async function completeTask(token, taskId, taskTitle, proxy, context) {
  const taskContext = `${context}|T${taskId.toString().slice(-6)}`;
  const url = 'https://neura-knights-api-prod.anomalygames.ai/api/quests';
  const payload = { quest_id: taskId };
  const config = getAxiosConfig(proxy, token);
  config.validateStatus = (status) => status >= 200 && status < 500;
  const spinner = ora({ text: `Completing ${taskTitle}...`, spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('post', url, payload, config, 3, 2000, taskContext);
    if (response.data.success) {
      spinner.succeed(chalk.bold.greenBright(` Completed: ${taskTitle}`));
      return { success: true, message: `Completed: ${taskTitle}` };
    } else {
      spinner.warn(chalk.bold.yellowBright(` Failed to complete ${taskTitle}`));
      return { success: false, message: `Failed to complete ${taskTitle}` };
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to complete ${taskTitle}: ${error.message}`));
    return { success: false, message: `Failed: ${error.message}` };
  }
}

async function fetchState(novaLinkUserId, token, proxy, context) {
  const url = `https://neura-knights-api-prod.anomalygames.ai/api/state?novalink_user_id=${novaLinkUserId}`;
  const spinner = ora({ text: 'Fetching state...', spinner: 'dots' }).start();
  try {
    const config = getAxiosConfig(proxy, token, true);
    const response = await requestWithRetry('get', url, null, config, 3, 2000, context);
    spinner.stop();
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error('Failed to fetch state');
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to fetch state: ${error.message}`));
    return null;
  }
}

async function claimPackage(novaLinkUserId, token, proxy, context) {
  const url = `https://neura-knights-api-prod.anomalygames.ai/api/package/claim?novalink_user_id=${novaLinkUserId}`;
  const payload = { novalink_user_id: novaLinkUserId };
  const config = getAxiosConfig(proxy, token, true);
  config.validateStatus = (status) => status >= 200 && status < 500;
  const spinner = ora({ text: 'Claiming package...', spinner: 'dots' }).start();
  try {
    const response = await requestWithRetry('post', url, payload, config, 3, 2000, context);
    if (response.data.success) {
      spinner.succeed(chalk.bold.greenBright(` Packs claimed successfully`));
      return { success: true };
    } else {
      spinner.warn(chalk.bold.yellowBright(` Failed to claim packs`));
      return { success: false };
    }
  } catch (error) {
    spinner.fail(chalk.bold.redBright(` Failed to claim packs: ${error.message}`));
    return { success: false };
  }
}

async function processAccount(token, index, total, proxy) {
  const context = `Account ${index + 1}/${total}`;
  logger.info(chalk.bold.magentaBright(`Starting account processing`), { emoji: '🚀 ', context });

  const { email, novaLinkUserId } = await fetchProfile(token, proxy, context);

  printHeader(`Account Info ${context}`);
  printInfo('Email', email, context);
  const ip = await getPublicIP(proxy, context);
  printInfo('IP', ip, context);
  console.log('\n');

  try {
    logger.info('Checking for packs claim...', { emoji: '📦 ', context });
    const state = await fetchState(novaLinkUserId, token, proxy, context);
    if (state) {
      const nextClaim = state.next_package_claim_at;
      const currentTime = new Date();
      if (nextClaim === null || currentTime >= new Date(nextClaim)) {
        await claimPackage(novaLinkUserId, token, proxy, context);
      } else {
        const nextClaimDate = new Date(nextClaim);
        const diffMs = nextClaimDate - currentTime;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        logger.info(chalk.yellowBright(`Packs not ready to claim yet. Cooldown: ${diffDays} days and ${diffHours} hours`), { emoji: '⏳ ', context });
      }
    } else {
      logger.warn('Failed to fetch state, skipping claim', { emoji: '⚠️ ', context });
    }

    logger.info('Starting tasks processing...', { emoji: '📋 ', context });
    
    const activeTasks = await fetchActiveTasks(token, proxy, context);
    const pendingTasks = activeTasks.filter(task => task.claimable === true && task.userQuest === null);

    if (pendingTasks.length === 0) {
      logger.info('No tasks ready to complete', { emoji: '⚠️ ', context });
    } else {
      console.log();
      const bar = new ProgressBar('Processing tasks [:bar] :percent :etas', {
        complete: '█',
        incomplete: '░',
        width: 30,
        total: pendingTasks.length
      });

      let completedCount = 0;

      for (const task of pendingTasks) {
        try {
          const result = await completeTask(token, task.id, task.title || 'Unknown Task', proxy, context);
          if (result.success) {
            completedCount++;
          }
        } catch (error) {
          logger.error(`Error completing task ${task.id}: ${error.message}`, { context });
        }
        bar.tick();
        await delay(2);
      }
      console.log();
      logger.info(`Processed ${pendingTasks.length} Tasks: ${completedCount} Completed`, { emoji: '📊 ', context });
    }

    await formatTaskTable(activeTasks, context);

    const totalPoints = await fetchUserPoints(novaLinkUserId, token, proxy, context);
    printProfileInfo(email, totalPoints, context);

    logger.info(chalk.bold.greenBright(`Completed account processing`), { emoji: '🎉 ', context });
    console.log(chalk.cyanBright('________________________________________________________________________________'));
  } catch (error) {
    logger.error(`Error processing account: ${error.message}`, { emoji: '❌ ', context });
  }
}

async function getPublicIP(proxy, context) {
  try {
    const config = getAxiosConfig(proxy);
    const response = await requestWithRetry('get', 'https://api.ipify.org?format=json', null, config, 3, 2000, context);
    return response.data.ip || 'Unknown';
  } catch (error) {
    logger.error(`Failed to get IP: ${error.message}`, { emoji: '❌ ', context });
    return 'Error retrieving IP';
  }
}

let globalUseProxy = false;
let globalProxies = [];

async function initializeConfig() {
  const useProxyAns = await askQuestion(chalk.cyanBright('🔌 Do You Want to Use Proxy? (y/n): '));
  if (useProxyAns.trim().toLowerCase() === 'y') {
    globalUseProxy = true;
    globalProxies = await readProxies();
    if (globalProxies.length === 0) {
      globalUseProxy = false;
      logger.warn('No proxies available, proceeding without proxy.', { emoji: '⚠️ ' });
    }
  } else {
    logger.info('Proceeding without proxy.', { emoji: 'ℹ️ ' });
  }
}

async function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function runCycle() {
  const tokens = await readTokens();
  if (tokens.length === 0) {
    logger.error('No tokens found in token.txt. Exiting cycle.', { emoji: '❌ ' });
    return;
  }

  for (let i = 0; i < tokens.length; i++) {
    const proxy = globalUseProxy ? globalProxies[i % globalProxies.length] : null;
    try {
      await processAccount(tokens[i], i, tokens.length, proxy);
    } catch (error) {
      logger.error(`Error processing account: ${error.message}`, { emoji: '❌ ', context: `Account ${i + 1}/${tokens.length}` });
    }
    if (i < tokens.length - 1) {
      console.log('\n\n');
    }
    await delay(5);
  }
}

async function run() {
  const terminalWidth = process.stdout.columns || 80;
  cfonts.say('NEXTGEN NEXUS', {
    font: 'block',
    align: 'center',
    colors: ['cyan', 'magenta'],
    background: 'transparent',
    letterSpacing: 1,
    lineHeight: 1,
    space: true
  });
  console.log(gradient.passion(centerText('=== Telegram Channel 🚀 : NextGen Nexus (@Dope_ZaYN) ===', terminalWidth)));
  console.log(gradient.passion(centerText('✪ NEURAKNIGHT AUTO DAILY BOT ✪', terminalWidth)));
  console.log('\n');
  await initializeConfig();

  while (true) {
    await runCycle();
    console.log();
    logger.info(chalk.bold.yellowBright('Cycle completed. Waiting 24 hours...'), { emoji: '🔄 ' });
    await delay(86400);
  }
}

run().catch(error => logger.error(`Fatal error: ${error.message}`, { emoji: '❌' }));
