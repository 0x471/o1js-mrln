import { TestingAppChain } from "@proto-kit/sdk";
import { Bool, Field, Poseidon, PublicKey } from "o1js";
import { PrivateKey } from "o1js";
import { Balances } from "../src/balances";
import { MRLNContract } from "../src/mrln";
import { log } from "@proto-kit/common";
import { BalancesKey, TokenId, UInt64 } from "@proto-kit/library";


log.setLevel("ERROR");

const mrlnInitialTokenBalance = 1000000;
const minimalDeposit = new Field(100);
const maximalRate = new Field(1 << 16 - 1);
const depth = 20;
const setSize = new Field(1 << depth);
const feePercentage = new Field(10);
const freezePeriod = new Field(1)

const identityCommitmentAlice = 1234;
const identityCommitmentBob = 5678;

const messageLimitAlice = 2;
const messageLimitBob = 3;

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
    it("test initial state", async () => {
        const appChain = TestingAppChain.fromRuntime({
            Balances,
            MRLNContract
        });


        appChain.configurePartial({
            Runtime: {
                Balances: {
                    totalSupply: UInt64.from(1000000000),
                },
                MRLNContract: {
                }
            },
        });

        await appChain.start();

        const mrln = appChain.runtime.resolve("MRLNContract");


        appChain.setSigner(alicePrivateKey);
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
        expect(minimalDepositState?.toBigInt()).toBe(minimalDeposit.toBigInt());
        expect(maximalRateState?.toBigInt()).toBe(maximalRate.toBigInt());
        expect(setSizeState?.toBigInt()).toBe(setSize.toBigInt());
        expect(feePercentageState?.toBigInt()).toBe(feePercentage.toBigInt());
        expect(feeReceiverState?.toJSON()).toBe(feeReceiver.toJSON());
        expect(freezePeriodState?.toBigInt()).toBe(freezePeriod.toBigInt());
        expect(mrlnAddrState?.toJSON()).toBe(addr.toJSON());

    }),
    it("test register succeeds", async () => {
        const appChain = TestingAppChain.fromRuntime({
            Balances,
            MRLNContract
        });


        appChain.configurePartial({
            Runtime: {
                Balances: {
                    totalSupply: UInt64.from(1000000000000),
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

        const receiver = PrivateKey.random()
        const feeReceiver = receiver.toPublicKey();


        const tx1 = await appChain.transaction(alice, () => {
            mrln.init(addr, minimalDeposit, maximalRate, setSize, feePercentage, feeReceiver, freezePeriod);
        });

        await tx1.sign();
        await tx1.send();
        const block1 = await appChain.produceBlock()
        block1?.transactions[0].status.assertEquals(true);

        const minimalDepositState = await appChain.query.runtime.MRLNContract.MINIMAL_DEPOSIT.get();
        const maximalRateState = await appChain.query.runtime.MRLNContract.MAXIMAL_RATE.get();
        const setSizeState = await appChain.query.runtime.MRLNContract.SET_SIZE.get();
        const feePercentageState = await appChain.query.runtime.MRLNContract.FEE_PERCENTAGE.get();
        const feeReceiverState = await appChain.query.runtime.MRLNContract.FEE_RECEIVER.get();
        const freezePeriodState = await appChain.query.runtime.MRLNContract.FREEZE_PERIOD.get();
        const mrlnAddrState = await appChain.query.runtime.MRLNContract.MRLN_ADDRESS.get();

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
        const registerAmountAlice = BigInt(messageLimitAlice) * minimalDeposit.toBigInt();

        const tokenId = TokenId.from(0);

        const tx2 = await appChain.transaction(alice, () => {
            balances.addBalance(tokenId, mrlnAddrState, UInt64.from(mrlnInitialTokenBalance));
        });
        await tx2.sign();
        await tx2.send();
        const block2 = await appChain.produceBlock();
        block2?.transactions[0].status.assertEquals(true);

        const keyMRLN = new BalancesKey({ tokenId, address: mrlnAddrState });
        const balanceMRLNBefore = await appChain.query.runtime.Balances.balances.get(keyMRLN);
        if (balanceMRLNBefore == undefined) {
            throw new Error("Balance MRLN Before is undefined");
        }
        //expect(balanceMRLNBefore.value.toString()).toBe(mrlnInitialTokenBalance.toString());
        console.log("MRLN BALANCE: BEFORE: ", balanceMRLNBefore.toString())
        const tx3 = await appChain.transaction(alice, () => {
            balances.addBalance(tokenId, alice, UInt64.from(registerAmountAlice));
        });
        await tx3.sign();
        await tx3.send();
        const block3 = await appChain.produceBlock();
        block3?.transactions[0].status.assertEquals(true);

        const keyAlice = new BalancesKey({ tokenId, address: alice });
        const balanceAliceBefore = await appChain.query.runtime.Balances.balances.get(keyAlice);
        if (balanceAliceBefore == undefined) {
            throw new Error("Balance Alice before is undefined")
        }
        console.log("ALICE BALANCE: BEFORE:", balanceAliceBefore.toString())
        //const identityCommitmentIndexBefore = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();

        const tx4 = await appChain.transaction(alice, () => {
            mrln.register(UInt64.from(identityCommitmentAlice), UInt64.from(registerAmountAlice));
        });
        await tx4.sign();
        await tx4.send();
        const block4 = await appChain.produceBlock();
        block4?.transactions[0].status.assertEquals(true);

        const balanceMRLNAfter = await appChain.query.runtime.Balances.balances.get(keyMRLN)
        if (balanceMRLNAfter == undefined) {
            throw new Error("Balance MRLN After is undefined");
        }
        console.log("MRLN BALANCE: AFTER: ", balanceMRLNAfter.toString())
        const tokenMRLNDiff = balanceMRLNAfter.value.sub(balanceMRLNBefore.value);
        expect(tokenMRLNDiff.toString()).toBe(registerAmountAlice.toString());

        const balanceAliceAfter = await appChain.query.runtime.Balances.balances.get(keyAlice);
        if (balanceAliceAfter == undefined) {
            throw new Error("Balance Alice after is undefined")
        }
        console.log("ALICE BALANCE: AFTER:", balanceAliceBefore.toString())
    })
});

