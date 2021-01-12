const ethers = require('ethers');
const provider = new ethers.providers.InfuraProvider("homestead", process.env.INFURA_KEY);

let wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
wallet = wallet.connect(provider);

module.exports = {
    wallet,
    provider
}

