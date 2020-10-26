const twitter = require('twitter-lite');

const config = {  
    consumer_key: process.env.TW_CONSUMER_KEY || '',  
    consumer_secret: process.env.TW_CONSUMER_SECRET || '',
    access_token_key: process.env.TW_ACCESSTOKEN_KEY || '',
    access_token_secret: process.env.TW_ACCESSTOKEN_SECRET || '',
};

const tweet = async (message) => {
    const client = new twitter(config);
    client.post('statuses/update', { status: message }).then(result => {
        console.log('You successfully tweeted this : "' + result.text + '"');
    }).catch(console.error);
};

exports.notify = tweet;

