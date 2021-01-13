const ethers = require('ethers');
const chalk = require('chalk');
const emoji = require('node-emoji-new');
const cliProgress = require('cli-progress');
const Table = require('cli-table2');
const ovenABI = require('../abis/oven.json');
const recipeABI = require('../abis/recipe.json');
const gasNow = require('../apis/gasnow');  
const discord = require('../apis/discord');

const wallet = require('../wallet').wallet;
const provider = require('../wallet').provider;

const MaxETHTranche = ethers.utils.parseEther("30");
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
    },
    {
        addressOven: '0xAedec86DeDe3DEd9562FB00AdA623c0e9bEEb951',
        deprecated: false,
        minimum: 10,
        name: 'YPIE Oven',
        description: 'Bakes YPIE at Zero cost',
        data: {
          ethBalance: 0,
          pieBalance: 0
        },
        baking: {
            symbol: "YPIE",
            address: "0x17525e4f4af59fbc29551bc4ece6ab60ed49ce31"
        },
        highlight: true,
        enabled: true,
      }
  ]

let txInProgress  = {};

ovens.forEach(ov => {
    txInProgress[ov.addressOven] = false;
})

async function checkOven(ov, execute=true) {    
    const balance = await provider.getBalance(ov.addressOven) / 1e18;

    if(balance >= ov.minimum) {
        console.log(`Balance ${ov.name}: ${balance} ETH`);

        let gasPrices = await gasNow.fetchGasPrice();
        const table1 = new Table({ style: { head: [], border: [] } });
        table1.push(['Rapid', 'Fast', 'Standard', 'Timestamp']);
        table1.push([gasPrices.rapid, gasPrices.fast, gasPrices.standard, gasPrices.timestamp]);
        console.log(table1.toString())

        if(txInProgress[ov.addressOven]) {
            console.log(chalk.red(`Tx still in progress: ${txInProgress[ov.addressOven]} \n`));
            return;
        }

        if(gasPrices.fast < 80000000000 && !ov.deprecated && txInProgress) {
            await bake(
                ov.addressOven,
                3604155,
                3, //Slippage
                20, //max_addresses
                1, //min_addresses
                ethers.utils.parseEther("0.1"), // minAmount
                execute, //execute
                ov.baking.symbol
            );
        } else {
            console.log('\n Gas price too high, checking again in a bit.\n')
        }
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
    symbol,
    verbose = false
) {
    try {
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

        const bar1 = new cliProgress.SingleBar({
            format: '|' + chalk.yellow('{bar}') + '| {percentage}% || {value}/{total} Deposits',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: false
        });
        bar1.start(deposits.length, 0);

        for( const [i, deposit] of deposits.entries()) {
            const user = deposit.args.user;
            const balance = await oven.ethBalanceOf(user);
            if (addresses.includes(user)) {
                bar1.update(i+1);
                continue
            }

            if (balance.lt(minAmount)) {
                if(verbose)
                    console.log("Skipping", user,"(", balance.toString(), ")...")
                
                bar1.update(i+1);
                continue
            }

            if(verbose)
                console.log("\nAdding", user, "(", balance.toString(), ")...")

            addresses.push(user)

            inputAmount = inputAmount.add(ethers.BigNumber.from(balance))

            if (inputAmount.gt(MaxETHTranche)) {
                inputAmount = MaxETHTranche;
                bar1.update(deposits.length);
                break;
            }

            if (addresses.length >= max_addresses) {
                console.log("\nMax addressess reached, continuing..\n")
                bar1.update(deposits.length);
                break
            }

            bar1.update(i+1);
        }

        if (addresses.length < min_addresses) {
            console.log(`\nAddressess is less than min_addresses\n`);
            return;
            //throw new Error("Addressess is less than min_addresses")
        }

        console.log("\n~Done getting addresses~\n")
        console.log("Calculating output amount...")

        let calculateFor = utils.parseEther("1");

        const etherJoinAmount = await recipe.calcToPie(pie_address, calculateFor);
        const outputAmount =  inputAmount.mul(calculateFor).div(etherJoinAmount).div(100).mul(100-slippage);

        
        console.log("Swapping", inputAmount.toString(), "for", outputAmount.toString())
        console.log("Start baking...")

        const call = oven.interface.encodeFunctionData("bake", [addresses, outputAmount, inputAmount])
        if(verbose)
            console.log("\n\nCalldata:\n\n", call)

        let gasPrices = await gasNow.fetchGasPrice();

        let overrides = {
            gasLimit: 7000000
        };

        if(gasPrices.fast) {
            overrides.gasPrice = gasPrices.fast;
        }

        if(verbose)
            console.log('Bake Session data', {
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

            if(verbose)
                console.log('baketx', baketx);

            let message = `:pie:  **Baking in process** :pie:
        
    The Oven is baking \`${outputAmount/1e18} ${symbol}\`
    https://etherscan.io/tx/${baketx.hash}`;

            await discord.notify(message)
            
            if(verbose)
                console.log(message)

            txInProgress[oven_address] = `https://etherscan.io/tx/${baketx.hash}`;
            console.log('Tx Broadcasted: ', txInProgress[oven_address]);
            
            let receipt = await baketx.wait();
            if(receipt.status === 1) {
                console.log(`${chalk.green(`${emoji.get('check_mark_button')} ${baketx.hash} mined successully`)}`);
            } else {
                console.log(`${chalk.red(`${emoji.get('cross_mark')} ${baketx.hash} failed`)}`);
            }
            txInProgress[oven_address] = false;
           
        }

    } catch (e) {
        console.log(e)
    }
    
}

async function run(execute=true) {
    ovenState();    
    try {
        for (const ov of ovens) {
            await checkOven(ov, execute)
        }
    } catch(e) {
        console.log(e.message);
    }
    console.log('\n\n')
}

function ovenState() {
    console.log(chalk.yellow(`Baking State of Ovens`));
    const table1 = new Table({ style: { head: [], border: [] } });
    table1.push(ovens.map(o => o.name));
    table1.push(ovens.map(o => txInProgress[o.addressOven]));
    console.log(table1.toString());  
};


module.exports = {
    run,
    ovenState
}