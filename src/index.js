require('dotenv').config();
const sound = require('sound-play')
const ethers = require('ethers');
const pieABI = require('./abis/pie.json');
const ovenABI = require('./abis/oven.json');
const recipeABI = require('./abis/recipe.json');
const gasNow = require('./apis/gasnow');  
const discord = require('./apis/discord');

const provider = new ethers.providers.InfuraProvider("homestead", process.env.INFURA_KEY);

let wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
console.log('PRIVATE_KEY', process.env.PRIVATE_KEY)
    wallet = wallet.connect(provider);

console.log('wallet', wallet.getAddress())    

const ovens = [
    {
      addressOven: '0x1d616dad84dd0b3ce83e5fe518e90617c7ae3915',
      deprecated: false,
      name: 'DEFI++ Oven',
      description: 'Bakes DEFI++ at Zero cost',
      minimum: 10,
      data: {
        ethBalance: 0,
        pieBalance: 0
      },
      baking: {
          symbol: "DEFI++",
          address: "0x8d1ce361eb68e9e05573443c407d4a3bed23b033",
      },
      highlight: true,
      enabled: true,
    },
    {
      addressOven: '0xE3d74Df89163A8fA1cBa540FF6B339d13D322F61',
      deprecated: false,
      minimum: 10,
      name: 'BCP Oven',
      description: 'Bakes BCP at Zero cost',
      data: {
        ethBalance: 0,
        pieBalance: 0
      },
      baking: {
          symbol: "BCP",
          address: "0xe4f726adc8e89c6a6017f01eada77865db22da14",
      },
      highlight: true,
      enabled: true,
    }
  ]

const MaxETHTranche = ethers.utils.parseEther("30");

async function run() {
    ovens.forEach( ov => checkOven(ov));
    console.log('\n\n')
}

async function checkOven(ov) {    
    const balance = await provider.getBalance(ov.addressOven) / 1e18;

    if(balance >= ov.minimum) {
        console.log(`Balance ${ov.name}: ${balance}`);
        //sound.play('src/hello.mp3');
        await bake(
            ov.addressOven,
            3604155,
            3, //Slippage
            6, //max_addresses
            1, //min_addresses
            ethers.utils.parseEther("0.1"), //minAmount
            true, //execute
            ov.baking.symbol
        );
    } else {
        console.log(`${new Date()} Balance ${ov.name}: ${balance} ETH`)
    }
}

async function bake(
    oven_address = '0x1d616dad84dd0b3ce83e5fe518e90617c7ae3915',
    start_block = 3604155,
    slippage = 3,
    max_addresses = 6, 
    min_addresses = 1,
    minAmount = ethers.utils.parseEther("0.1"), // Min amount to be considered for baking
    execute = false,
    symbol
) {
    let addresses = []
    let { utils } = ethers;
    let inputAmount = ethers.BigNumber.from("0")

    let oven = new ethers.Contract(oven_address, ovenABI, wallet);
    const pie_address = await oven.pie();
    const recipe_address = await oven.recipe();
    const recipe = new ethers.Contract(recipe_address, recipeABI, wallet);

    console.log("\tUsing pie @", pie_address);
    console.log("\n~Getting addresses~")
    const deposits = await oven.queryFilter(oven.filters.Deposit(), start_block, "latest")
    for(const deposit of deposits) {
        const user = deposit.args.user;
        const balance = await oven.ethBalanceOf(user);
        if (addresses.includes(user)) {
            continue
        }

        if (balance.lt(minAmount)) {
            console.log("Skipping", user,"(", balance.toString(), ")...")
            continue
        }
        console.log("Adding", user, "(", balance.toString(), ")...")
        addresses.push(user)

        inputAmount = inputAmount.add(ethers.BigNumber.from(balance))

        if (inputAmount.gt(MaxETHTranche)) {
            inputAmount = MaxETHTranche;
            break;
        }

        if (addresses.length >= max_addresses) {
            console.log("Max addressess reached, continuing..")
            break
        }
    }

    if (addresses.length < min_addresses) {
        console.log(`Addressess is less than min_addresses`);
        return;
        //throw new Error("Addressess is less than min_addresses")
    }

    console.log("~Done getting addresses~\n")
    console.log("Calculating output amount...")

    let calculateFor = utils.parseEther("1");

    const etherJoinAmount = await recipe.calcToPie(pie_address, calculateFor);
    const outputAmount =  inputAmount.mul(calculateFor).div(etherJoinAmount).div(100).mul(100-slippage);

    
    console.log("Swapping", inputAmount.toString(), "for", outputAmount.toString())
    console.log("Start baking...")

    const call = oven.interface.encodeFunctionData("bake", [addresses, outputAmount, inputAmount])

    console.log("\n\nCalldata:\n\n", call)

    let gasPrices = await gasNow.fetchGasPrice();
    // console.log('gasPrices', gasPrices);

    let overrides = {
        gasLimit: 6000000
    };

    if(gasPrices.fast) {
        overrides.gasPrice = gasPrices.fast;
    }

    console.log('data', {
        addresses,
        outputAmount: outputAmount.toString(),
        maxPrice: inputAmount.toString(),
        gasPrices,
        overrides
    });

    if(execute) {
        const baketx = await oven["bake(address[],uint256,uint256)"](
            addresses,
            outputAmount,
            inputAmount,
            overrides
        );

        console.log('baketx', baketx);

        let message = `:pie:  **Baking in process** :pie:
    
The Oven is baking \`${outputAmount/1e18} ${symbol}\`
https://etherscan.io/tx/${baketx.hash}`;

        await discord.notify(message)
        console.log(message)
    }
    
}


setInterval(function(){ run()}, process.env.INTERVAL || 210000)
run();