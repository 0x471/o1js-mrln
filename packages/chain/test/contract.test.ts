import { TestingAppChain } from "@proto-kit/sdk";
import { Field } from "o1js";
import { PrivateKey } from "o1js";
import { Balances } from "../src/balances";
import { MRLNContract } from "../src/mrln";
import { log } from "@proto-kit/common";
import { BalancesKey, TokenId, UInt64 } from "@proto-kit/library";


log.setLevel("ERROR");

const rlnInitialTokenBalance = 1000000;
const minimalDeposit = 100;
const maximalRate = 1 << 16 - 1;
const depth = 20;
const feePercentage = 10;
const freezePeriod = 1;
const identityCommitment0 = 1234;
const identityCommitment1 = 5678;

describe("mrln contract", () => {
    it("test initial state", async () => {
        const appChain = TestingAppChain.fromRuntime({
            Balances,
            MRLNContract
        });


        appChain.configurePartial({
            Runtime: {
                Balances: {
                    totalSupply: UInt64.from(10000),
                },
                MRLNContract: {
                }
            },
        });

        await appChain.start();

        const mrln = appChain.runtime.resolve("MRLNContract");
        const alicePrivateKey = PrivateKey.random();
        const alice = alicePrivateKey.toPublicKey();

        appChain.setSigner(alicePrivateKey);

        const minimalDeposit = new Field(100);
        const maximalRate = new Field(1 << 16 - 1);
        const depth = 20;
        const setSize = new Field(1 << depth);
        const feePercentage = new Field(10);
        const freezePeriod = new Field(1)
        const receiver = PrivateKey.random()
        const feeReceiver = receiver.toPublicKey();

    
        const tx1 = await appChain.transaction(alice, () => {
            mrln.init(minimalDeposit, maximalRate, setSize, feePercentage, feeReceiver, freezePeriod);
          });
      
          await tx1.sign();
          await tx1.send();
        await appChain.produceBlock();

        const minimalDepositState = await appChain.query.runtime.MRLNContract.MINIMAL_DEPOSIT.get();
        const maximalRateState = await appChain.query.runtime.MRLNContract.MAXIMAL_RATE.get();
        const setSizeState = await appChain.query.runtime.MRLNContract.SET_SIZE.get();
        const feePercentageState = await appChain.query.runtime.MRLNContract.FEE_PERCENTAGE.get();
        const feeReceiverState= await appChain.query.runtime.MRLNContract.FEE_RECEIVER.get();
        const freezePeriodState =  await appChain.query.runtime.MRLNContract.FREEZE_PERIOD.get();

        expect(minimalDepositState?.toBigInt()).toBe(minimalDeposit.toBigInt());
        expect(maximalRateState?.toBigInt()).toBe(maximalRate.toBigInt());
        expect(setSizeState?.toBigInt()).toBe(setSize.toBigInt());
        expect(feePercentageState?.toBigInt()).toBe(feePercentage.toBigInt());
        expect(feeReceiverState?.toJSON()).toBe(feeReceiver.toJSON());
        expect(freezePeriodState?.toBigInt()).toBe(freezePeriod.toBigInt());
          
    });
});

