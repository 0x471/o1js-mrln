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

        const receiver = PrivateKey.random()
        const feeReceiver = receiver.toPublicKey();

        appChain.configurePartial({
            Runtime: {
                Balances: {
                    totalSupply: UInt64.from(10000),
                },
                MRLNContract: {
                    minimalDeposit: new Field(minimalDeposit),
                    maximalRate: new Field(maximalRate),
                    depth: new Field(depth),
                    feePercentage: new Field(feePercentage),
                    feeReceiver: feeReceiver,
                    freezePeriod: freezePeriod
                }
            },
        });

        await appChain.start();

        const alicePrivateKey = PrivateKey.random();
        const alice = alicePrivateKey.toPublicKey();
        const tokenId = TokenId.from(0);

        appChain.setSigner(alicePrivateKey);

        const balances = appChain.runtime.resolve("MRLNContract");
        const minimal_deposit = await appChain.query.runtime.MRLNContract.FEE_PERCENTAGE;
        const maximal_rate = await appChain.query.runtime.MRLNContract.MAXIMAL_RATE;
        const set_size = await appChain.query.runtime.MRLNContract.SET_SIZE;
        const fee_percentage = await appChain.query.runtime.MRLNContract.FEE_PERCENTAGE;
        const fee_receiver = await appChain.query.runtime.MRLNContract.FEE_RECEIVER;
        const freeze_period =  await appChain.query.runtime.MRLNContract.FREEZE_PERIOD;
    });
});

