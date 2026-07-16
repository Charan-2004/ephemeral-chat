require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

async function postTweet() {
  const tweetText = process.argv[2];
  
  if (!tweetText) {
    console.error('Error: Please provide the tweet text as an argument.');
    process.exit(1);
  }

  // Ensure env variables are present
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET || !process.env.TWITTER_ACCESS_TOKEN || !process.env.TWITTER_ACCESS_SECRET) {
    console.error('Error: Missing Twitter API credentials in .env file.');
    process.exit(1);
  }

  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  });

  try {
    const rwClient = client.readWrite;
    const { data } = await rwClient.v2.tweet(tweetText);
    console.log(`Successfully posted tweet: ${data.id}`);
  } catch (error) {
    console.error('Error posting tweet:', error);
    process.exit(1);
  }
}

postTweet();
