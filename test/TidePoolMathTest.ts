import { expect } from "chai";
import { ethers } from "hardhat";
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import { TidePoolMath } from "../typechain"
import { BigNumber } from "ethers"

describe("TidePoolMath", function () {
  let tpm: TidePoolMath

  const random = (max: number) => {
    return Math.floor(Math.random() * max)
  }

  const randomTick = (spacing: number) => {
    const tick = Math.floor(random(887272) / spacing) * spacing
    return random(2) > 0 ? tick : -tick
  }

  before("deploy", async function () {
    const TidePoolMath = await ethers.getContractFactory("TidePoolMath")
    tpm = await TidePoolMath.deploy()
  });

  it("should calculate window", async () => {
    const three = random(3)
    const spacing = three === 0 ? 10 : three === 1 ? 60 : 200
    const tick = randomTick(spacing)
    
    const window = random(99)
    const bias = random(100)

    const [upper, lower] = await tpm.calculateWindow(tick, spacing, window, bias)

    expect(upper).to.be.gte(tick)
    expect(lower).to.be.lte(tick)

    // IMPORTANT: tick boundaries must have proper spacing or the mint function fails without a message
    // tick % spacing = 0 is a valid tick
    expect(upper % spacing).to.eq(0)
    expect(lower % spacing).to.eq(0)
  })

  it("zeroIsLessUsed", async () => {
    let p = await tpm.zeroIsLessUsed(10, 100, 20, 500)

    expect(p).to.eq(false)

    p = await tpm.zeroIsLessUsed(1000000, 100000000, 20, 5000)

    expect(p).to.eq(false)

    p = await tpm.zeroIsLessUsed(100, BigNumber.from("10000000000000000"), 50000000000, 200000000000)

    expect(p).to.eq(true)
  })

  it("Increases tick window", async ()=> {
    const n = random(100)
    let p = await tpm.getWindowSize(n, (await ethers.provider.getBlockNumber()).toString(), true)

    expect(p).to.eq(n + 10)
  })

  it("Decreases tick window", async ()=> {
    const n = random(100) + 12
    const day = 86400
    const numberOfDays = random(10)
    const block = await ethers.provider.getBlock("latest")
    let p = await tpm.getWindowSize(n, block.timestamp - (day * numberOfDays), false)

    expect(p).to.eq(n - numberOfDays)
  })

  it("Limits tick window", async ()=> {

    let p = await tpm.getWindowSize(3, 2, false)

    expect(p).to.eq(2)
  })

});


