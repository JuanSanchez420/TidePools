// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you"ll find the Hardhat
// Runtime Environment"s members available in the global scope.
const hre = require("hardhat")
/*
import {
  abi as ERC20_ABI,
  bytecode as ERC20_BYTECODE,
} from '@openzeppelin/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
*/

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run("compile");

  /*
    to increase gas, put the options obj as the last param in deploy()

      const options = {
        gasLimit: 6_000_000,
    }

  */
  const delay = (ms) => new Promise((res) => setTimeout(res, ms))

  // const POOL = process.env.POOL
  const TREASURY = process.env.TREASURY
  const UNISWAP_FACTORY = process.env.UNISWAP_FACTORY

  //console.log(`POOL: ${POOL}`)
  console.log(`TREASURY: ${TREASURY}`)

  const TidePoolMath = await hre.ethers.getContractFactory("TidePoolMath")
  const tidepoolmath = await TidePoolMath.deploy()
  await tidepoolmath.deployed()

  const PoolActions = await hre.ethers.getContractFactory("PoolActions")
  const poolactions = await PoolActions.deploy()
  await poolactions.deployed()

  const FactoryValidator = await hre.ethers.getContractFactory(
    "FactoryValidator"
  )
  const factoryvalidator = await FactoryValidator.deploy()
  await factoryvalidator.deployed()

  const TidePoolFactory = await hre.ethers.getContractFactory(
    "TidePoolFactory",
    {
      libraries: {
        TidePoolMath: tidepoolmath.address,
        PoolActions: poolactions.address,
        FactoryValidator: factoryvalidator.address,
      },
    }
  )
  const tidePoolFactory = await TidePoolFactory.deploy(
    UNISWAP_FACTORY,
    TREASURY
  )
  await tidePoolFactory.deployed()

  console.log("TidePoolFactory deployed to:", tidePoolFactory.address)

  console.log("We verify now, Please wait!")
  await delay(45000)

  console.log("Verifying FactoryValidator...")
  try {
    await hre.run("verify:verify", {
      address: factoryvalidator.address,
      constructorArguments: [],
    })
  } catch (e) {
    console.log(e)
  }

  console.log("Verifying PoolActions...")
  try {
    await hre.run("verify:verify", {
      address: poolactions.address,
      constructorArguments: [],
    })
  } catch (e) {
    console.log(e)
  }

  console.log("Verifying TidePoolMath...")
  try {
    await hre.run("verify:verify", {
      address: tidepoolmath.address,
      constructorArguments: [],
    })
  } catch (e) {
    console.log(e)
  }

  console.log("Verifying TidePoolFactory...")
  try {
    await hre.run("verify:verify", {
      address: tidePoolFactory.address,
      constructorArguments: [UNISWAP_FACTORY, TREASURY],
      libraries: {
        PoolActions: poolactions.address,
        TidePoolMath: tidepoolmath.address,
        FactoryValidator: factoryvalidator.address,
      },
    })
  } catch (e) {
    console.log(e)
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
