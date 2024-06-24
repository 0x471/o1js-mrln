import { TestingAppChain } from "@proto-kit/sdk";
import { Bool, Encoding, Field, Poseidon, PublicKey } from "o1js";
import { PrivateKey } from "o1js";
import { Balances } from "../src/balances";
import { MRLNContract } from "../src/mrln";
import { log, sleep } from "@proto-kit/common";
import { BalancesKey, TokenId, UInt64 } from "@proto-kit/library";
import { emptyValue } from "o1js/dist/node/lib/proof_system";


log.setLevel("ERROR");

const rlnInitialTokenBalance = 1000000;
const minimalDeposit = 100;
const maximalRate = 1 << 16 - 1;
const depth = 20;
const feePercentage = 10;
const freezePeriod = 1;

const identityCommitmentAlice = 1234n;
const identityCommitmentBob = 5678n;

const messageLimitAlice = 2n;
const messageLimitBob = 3n;

const alicePrivateKey = PrivateKey.random();
const alice = alicePrivateKey.toPublicKey();

const bobPrivateKey = PrivateKey.random();
const bob = alicePrivateKey.toPublicKey();

const slashedReceiverPrivKey = PrivateKey.random();
const slashedReceiver = slashedReceiverPrivKey.toPublicKey();

const addr = PublicKey.from({
    x: Poseidon.hash([new Field(1337)]),
    isOdd: Bool(false),
});

describe("mrln contract", () => {
    // it("test initial state", async () => {
    //     const appChain = TestingAppChain.fromRuntime({
    //         Balances,
    //         MRLNContract
    //     });


    //     appChain.configurePartial({
    //         Runtime: {
    //             Balances: {
    //                 totalSupply: UInt64.from(10000),
    //             },
    //             MRLNContract: {
    //             }
    //         },
    //     });

    //     await appChain.start();

    //     const mrln = appChain.runtime.resolve("MRLNContract");


    //     appChain.setSigner(alicePrivateKey);

    //     const minimalDeposit = new Field(100);
    //     const maximalRate = new Field(1 << 16 - 1);
    //     const depth = 20;
    //     const setSize = new Field(1 << depth);
    //     const feePercentage = new Field(10);
    //     const freezePeriod = new Field(1)
    //     const receiver = PrivateKey.random()
    //     const feeReceiver = receiver.toPublicKey();

    //     const tx1 = await appChain.transaction(alice, () => {
    //         mrln.init(addr, minimalDeposit, maximalRate, setSize, feePercentage, feeReceiver, freezePeriod);
    //     });

    //     await tx1.sign();
    //     await tx1.send();
    //     await appChain.produceBlock();

    //     const minimalDepositState = await appChain.query.runtime.MRLNContract.MINIMAL_DEPOSIT.get();
    //     const maximalRateState = await appChain.query.runtime.MRLNContract.MAXIMAL_RATE.get();
    //     const setSizeState = await appChain.query.runtime.MRLNContract.SET_SIZE.get();
    //     const feePercentageState = await appChain.query.runtime.MRLNContract.FEE_PERCENTAGE.get();
    //     const feeReceiverState = await appChain.query.runtime.MRLNContract.FEE_RECEIVER.get();
    //     const freezePeriodState = await appChain.query.runtime.MRLNContract.FREEZE_PERIOD.get();
    //     const mrlnAddrState = await appChain.query.runtime.MRLNContract.MRLN_ADDRESS.get();
    //     expect(minimalDepositState?.toBigInt()).toBe(minimalDeposit.toBigInt());
    //     expect(maximalRateState?.toBigInt()).toBe(maximalRate.toBigInt());
    //     expect(setSizeState?.toBigInt()).toBe(setSize.toBigInt());
    //     expect(feePercentageState?.toBigInt()).toBe(feePercentage.toBigInt());
    //     expect(feeReceiverState?.toJSON()).toBe(feeReceiver.toJSON());
    //     expect(freezePeriodState?.toBigInt()).toBe(freezePeriod.toBigInt());
    //     expect(mrlnAddrState?.toJSON()).toBe(addr.toJSON());

    // }),
        it("test register succeeds", async () => {
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
            const balances = appChain.runtime.resolve("Balances");
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
                mrln.init(addr, minimalDeposit, maximalRate, setSize, feePercentage, feeReceiver, freezePeriod);
            });

            await tx1.sign();
            await tx1.send();
            await appChain.produceBlock();

            const minimalDepositState = await appChain.query.runtime.MRLNContract.MINIMAL_DEPOSIT.get();
            const maximalRateState = await appChain.query.runtime.MRLNContract.MAXIMAL_RATE.get();
            const setSizeState = await appChain.query.runtime.MRLNContract.SET_SIZE.get();
            const feePercentageState = await appChain.query.runtime.MRLNContract.FEE_PERCENTAGE.get();
            const feeReceiverState = await appChain.query.runtime.MRLNContract.FEE_RECEIVER.get();
            const freezePeriodState = await appChain.query.runtime.MRLNContract.FREEZE_PERIOD.get();
            const mrlnAddrState = await appChain.query.runtime.MRLNContract.MRLN_ADDRESS.get();
            console.log("ONE", minimalDepositState)
            expect(minimalDepositState?.toBigInt()).toBe(minimalDeposit.toBigInt());
            expect(maximalRateState?.toBigInt()).toBe(maximalRate.toBigInt());
            expect(setSizeState?.toBigInt()).toBe(setSize.toBigInt());
            expect(feePercentageState?.toBigInt()).toBe(feePercentage.toBigInt());
            expect(feeReceiverState?.toJSON()).toBe(feeReceiver.toJSON());
            expect(freezePeriodState?.toBigInt()).toBe(freezePeriod.toBigInt());
            expect(mrlnAddrState?.toJSON()).toBe(addr.toJSON());
            if (mrlnAddrState == undefined) {
                throw new Error("MRLN Address is undefined");
            }
            const registerAmountAlice = messageLimitAlice * minimalDeposit.toBigInt();
            const registerAmountBob = messageLimitBob * minimalDeposit.toBigInt();

            const tokenId = TokenId.from(0);
            const tx2 = await appChain.transaction(alice, () => {
                balances.addBalance(tokenId, alice, UInt64.from(registerAmountAlice));
            });

            await tx2.sign();
            await tx2.send();
            await appChain.produceBlock();

            const tx3 = await appChain.transaction(alice, () => {
                balances.addBalance(tokenId, mrlnAddrState, UInt64.from(1));
            });

            await tx3.sign();
            await tx3.send();
            await appChain.produceBlock();


            const keyMRLN = new BalancesKey({ tokenId, address: mrlnAddrState });
            const balanceMRLNBefore = await appChain.query.runtime.Balances.balances.get(keyMRLN);
            if (balanceMRLNBefore == undefined) {
                throw new Error("Balance MRLN Before is undefined");
            }

            const keyAlice = new BalancesKey({ tokenId, address: alice });
            const balanceAliceBefore = await appChain.query.runtime.Balances.balances.get(keyAlice);
            const identityCommitmentIndexBefore =  await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();

            console.log("TWO", await appChain.query.runtime.MRLNContract.MINIMAL_DEPOSIT.get())
            const tx4 = await appChain.transaction(alice, () => {
                mrln.register(UInt64.from(identityCommitmentAlice), UInt64.from(registerAmountAlice));
              });
              await tx4.sign();
              await tx4.send();
            await appChain.produceBlock();

            const balanceMRLNAfter= await appChain.query.runtime.Balances.balances.get(keyMRLN)
            if (balanceMRLNAfter == undefined) {
                throw new Error("Balance MRLN After is undefined");
            }   

            const tokenMRLNDiff = balanceMRLNAfter.sub(balanceMRLNBefore);
            expect(tokenMRLNDiff).toBe(registerAmountAlice);


        })
});

