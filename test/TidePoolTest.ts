import { expect } from "chai";
import { ethers } from "hardhat";
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import { TidePool, TidePoolFactory, Token, IUniswapV3Pool, TidePoolMath, SwapCallee, PoolActions, FactoryValidator } from "../typechain"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { encodePriceSqrt } from "./shared/encodePriceSqrt"
import { BigNumber } from "ethers"

import {
  abi as TIDEPOOL_ABI,
  bytecode as TIDEPOOL_BYTECODE,
 } from "../artifacts/contracts/TidePool.sol/TidePool.json"

import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'

import {
  abi as POOL_ABI,
  bytecode as POOL_BYTECODE,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'

describe("TidePool", function () {

  let token0: Token
  let token1: Token

  let user: SignerWithAddress
  let treasury: SignerWithAddress

  let treasury0Start: BigNumber
  let treasury1Start: BigNumber

  let swapper: SwapCallee

  let pool: IUniswapV3Pool

  let tpm: TidePoolMath
  let pa: PoolActions
  let tp: TidePool
  let tpf: TidePoolFactory
  let fv: FactoryValidator

  const getMinTick = (spacing: number) => Math.ceil(-887272 / spacing) * spacing
  const getMaxTick = (spacing: number) => Math.floor(887272 / spacing) * spacing
  const MAX_SQRT_RATIO = BigNumber.from("1461446703485210103287273052203988822378723970342")
  const MIN_SQRT_RATIO = BigNumber.from("4295128739")

  const random = (max: number) => {
    return Math.floor(Math.random() * max)
  }

  const print = async () => {
    console.log(`t0: ${await token0.balanceOf(tp.address)}, t1: ${await token1.balanceOf(tp.address)}}`);
    console.log(`totalSupply: ${await tp.totalSupply()}`);
  }

  let start0 = 1000
  let start1 = 1000
  const feeAmount = {
    fee: 500,
    tickSpacing: 10
  }

  before(async () => {
    [user, treasury] = await ethers.getSigners()

    const ContractERC20 = await ethers.getContractFactory("Token")
    token0 = await ContractERC20.deploy("token0", "t0", random(17)+1)
    token1 = await ContractERC20.deploy("token1", "t1", random(17)+1)

    if(Number(token0.address) > Number(token1.address)) {
      let temp = token1
      token1 = token0
      token0 = temp
    }

    // create UniswapV3Pool
    const ContractFactory = await ethers.getContractFactory(FACTORY_ABI, FACTORY_BYTECODE)
    const contractFactory = await ContractFactory.deploy()

    // await contractFactory.enableFeeAmount(feeAmount.fee, feeAmount.tickSpacing)

    const tx = await contractFactory.createPool(token0.address, token1.address, feeAmount.fee)
    const receipt = await tx.wait()
    const poolAddress = receipt.events?.[0].args?.pool as string

    pool = await ethers.getContractAt(POOL_ABI, poolAddress) as IUniswapV3Pool

    const TidePoolMathFactory = await ethers.getContractFactory("TidePoolMath")
    tpm = await TidePoolMathFactory.deploy()

    const PoolActionsFactory = await ethers.getContractFactory("PoolActions")
    pa = await PoolActionsFactory.deploy()

    const FactoryValidator = await ethers.getContractFactory("FactoryValidator")
    fv = await FactoryValidator.deploy()

    const TidePoolFactory = await ethers.getContractFactory("TidePoolFactory", { libraries: { TidePoolMath: tpm.address, PoolActions: pa.address, FactoryValidator: fv.address}})
    tpf = await TidePoolFactory.deploy(contractFactory.address, treasury.address)

    const tx2 = await tpf.deploy(poolAddress)
    const receipt2 = await tx2.wait()
    const tidePoolAddress = receipt2.events?.[2].args?.tidePool as string
    
/*
    const mtpf = await ethers.getContractFactory("MockTidePool", { libraries: { TidePoolMath: tpm.address, PoolActions: pa.address }})
    tp = mtpf.attach(await tpf.getTidePool(poolAddress))
*/
    tp = await ethers.getContractAt(TIDEPOOL_ABI, tidePoolAddress) as TidePool

    const SwapCalleFactory = await ethers.getContractFactory("SwapCallee")
    swapper = await SwapCalleFactory.deploy()

    await token0.approve(swapper.address, ethers.constants.MaxUint256)
    await token1.approve(swapper.address, ethers.constants.MaxUint256)

    await token0.approve(tp.address, ethers.constants.MaxUint256)
    await token1.approve(tp.address, ethers.constants.MaxUint256)
  })

    it("initialize pool", async ()=>{
      const sqrt = encodePriceSqrt(1,1)

      await expect(pool.initialize(sqrt)).to.emit(pool, 'Initialize')

      treasury0Start = await token0.balanceOf(await treasury.getAddress());
      treasury1Start = await token1.balanceOf(await treasury.getAddress());

      const spacing = await pool.tickSpacing()

      await expect(swapper.mint(pool.address, user.address, getMinTick(spacing), getMaxTick(spacing), 5000)).to.emit(pool, "Mint")
    })

    describe("Deposit", ()=>{
      it("need over 0 amounts", async () => {
        await expect(tp.deposit(0,0)).to.revertedWith("V")
      })
      
      it("deposits liquidity", async () => {
        await tp.deposit(start0, start1)

        expect(await tp.totalSupply()).to.gt(0)
      })
    })

    describe("Rebalance", ()=>{
      it("still in range, won't rebalance", async () => {
        expect(tp.rebalance()).to.be.reverted
      })
  
      it("move price out of range", async ()=>{
        const lower = await tp.upper()      
  
        const [before] = await pool.slot0()
  
        // basically empty the pool
        await swapper.swapExact0For1(pool.address, 2000, user.address, MIN_SQRT_RATIO.add(1))
  
        const [after, afterTick] = await pool.slot0()
  
        expect(before).to.be.gt(after)
        expect(afterTick).to.be.lt(lower)
      })

      it("rebalances and expands the window", async () => {
        const needsRebalance = await tp.needsRebalance()

        const windowB4 = await tp.window()

        expect(needsRebalance).to.eq(true)

        await expect(tp.rebalance()).to.emit(tp, "Rebalance")
        
        expect(await tp.window()).to.be.gt(windowB4)
      })

      it("slippage too high!", async () => {
        await expect(tp.deposit(10,10)).to.revertedWith("L")
      })

      it("move price back to range", async ()=>{
        const upper = await tp.upper()
  
        const [before] = await pool.slot0()
  
        await swapper.swapExact1For0(pool.address, 5000, user.address, MAX_SQRT_RATIO.sub(1))
  
        const [after, afterTick] = await pool.slot0()
  
        expect(before).to.be.lt(after)
        expect(afterTick).to.be.gt(upper)
      })

      it("whale deposit increases liquidity", async ()=>{
        const before = await pool.liquidity()

        await swapper.mint(pool.address, user.address, getMinTick(await pool.tickSpacing()), getMaxTick(await pool.tickSpacing()), BigNumber.from("10000000000000"))

        expect(before).to.lt(await pool.liquidity())
      })

      it("rebalance unlocks the TP", async () => {
        const needsRebalance = await tp.needsRebalance()
  
        expect(needsRebalance).to.eq(true)

        await expect(tp.rebalance()).to.emit(tp, "Rebalance")

        expect(await tp.locked()).to.eq(false)

      })

      it("deposits liquidity: pool unlocked", async () => {
        const start = await tp.totalSupply()

        const a0 = random(100000)
        const a1 = random(100000)
        await tp.deposit(a0, a1)

        const end = await tp.totalSupply()

        expect(start).to.lt(end)
      })

      it("test deposit 2", async () => {
        const start = await tp.totalSupply()

        const a0 = random(100000)
        const a1 = random(100000)
        await tp.deposit(a0, a1)

        const end = await tp.totalSupply()

        expect(start).to.lt(end)
      })

      it("test deposit with pool shift", async () => {
        const start = await tp.totalSupply()

        await swapper.swapExact1For0(pool.address, random(10000), user.address, MAX_SQRT_RATIO.sub(1))

        const a0 = random(100000)
        const a1 = random(100000)
        await tp.deposit(a0, a1)

        const end = await tp.totalSupply()

        expect(start).to.lt(end)
      })

      it("test deposit with pool shift 2", async () => {
        const start = await tp.totalSupply()

        await swapper.swapExact0For1(pool.address, random(10000), user.address, MIN_SQRT_RATIO.add(1))

        const a0 = random(100000)
        const a1 = random(100000)
        await tp.deposit(a0, a1)

        const end = await tp.totalSupply()

        expect(start).to.lt(end)
      })

    })

    describe("Rerange", ()=>{
      it("too early to rerange", async () => {
        await expect(tp.rebalance()).to.be.reverted
      })
/*
      it("reranges", async () => {
        const upperB4 = await tp.upper()
        const lowerB4 = await tp.lower()
  
        await tp.setlastRebalance(random(10)+1)
  
        await expect(tp.rebalance()).to.emit(tp, "Rebalance")
  
        const upper = await tp.upper()
        const lower = await tp.lower()
  
        expect(upperB4).to.be.gte(upper)
        expect(lowerB4).to.be.lte(lower)
        expect(upperB4 - lowerB4).to.be.gte(upper - lower)
        expect(await tp.totalSupply()).to.be.gt(0)
      })
*/
    })

    describe("Withdraw", ()=>{
      it("withdraw liquidity", async ()=>{
        await tp.withdraw()
  
        expect(await tp.totalSupply()).to.eq(0)
      })

      it("can't withdraw 0 balance", async () => {
        await expect(tp.withdraw()).to.be.reverted
      })

      it("Can't rebalance an empty TP", async ()=>{
        await expect(tp.rebalance()).to.be.reverted
      })
/*
      it("Can withdraw if failed to mint", async () => {
        await token0.transfer(tp.address, 10000)
        await token1.transfer(tp.address, 10000)
        await tp.mint(user.address, 1000)

        const t0B4 = await token0.balanceOf(user.address)
        const t1B4 = await token1.balanceOf(user.address)

        await expect(tp.withdraw()).to.emit(tp, "Withdraw")

        const t0After = await token0.balanceOf(user.address)
        const t1After = await token1.balanceOf(user.address)

        expect(t0After).to.be.gt(t0B4)
        expect(t1After).to.be.gt(t1B4)
      })
*/
    })

});

