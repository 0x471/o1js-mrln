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

            // MRLN: Init
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


            const tokenId = TokenId.from(0);

            // MRLN: Add Balance
            const tx2 = await appChain.transaction(alice, () => {
                balances.addBalance(tokenId, mrlnAddrState, UInt64.from(mrlnInitialTokenBalance));
            });
            await tx2.sign();
            await tx2.send();
            const block2 = await appChain.produceBlock();
            block2?.transactions[0].status.assertEquals(true);

            // Alice: Add Balance 
            const keyMRLN = new BalancesKey({ tokenId, address: mrlnAddrState });
            const balanceMRLNBeforeAlice = await appChain.query.runtime.Balances.balances.get(keyMRLN);
            if (balanceMRLNBeforeAlice == undefined) {
                throw new Error("Balance MRLN Before is undefined");
            }
            expect(balanceMRLNBeforeAlice.value.toString()).toBe(mrlnInitialTokenBalance.toString());

            const registerAmountAlice = BigInt(messageLimitAlice) * minimalDeposit.toBigInt();

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
                throw new Error("Balance Alice Before is undefined")
            }

            // Alice: Register 
            const identityCommitmentBeforeAlice = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();
            if (identityCommitmentBeforeAlice == undefined) {
                throw new Error("identityCommitmentBeforeAlice is undefined");
            }
            const tx4 = await appChain.transaction(alice, () => {
                mrln.register(UInt64.from(identityCommitmentAlice), UInt64.from(registerAmountAlice));
            });
            await tx4.sign();
            await tx4.send();
            const block4 = await appChain.produceBlock();
            block4?.transactions[0].status.assertEquals(true);

            const balanceMRLNAfterAlice = await appChain.query.runtime.Balances.balances.get(keyMRLN)
            if (balanceMRLNAfterAlice == undefined) {
                throw new Error("Balance MRLN After is undefined");
            }
            const tokenMRLNDiffAlice = balanceMRLNAfterAlice.value.sub(balanceMRLNBeforeAlice.value);
            expect(tokenMRLNDiffAlice.toString()).toBe(registerAmountAlice.toString());

            const identityCommitmentAfterAlice = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();
            identityCommitmentAfterAlice?.assertEquals((identityCommitmentBeforeAlice.add(new Field(1))));

            const balanceAliceAfter = await appChain.query.runtime.Balances.balances.get(keyAlice);
            if (balanceAliceAfter == undefined) {
                throw new Error("Balance Alice After is undefined")
            }
            const tokenAliceDiff = balanceAliceBefore.value.sub(balanceAliceAfter.value);
            expect(tokenAliceDiff.toString()).toBe(registerAmountAlice.toString());

            const memberAlice = await appChain.query.runtime.MRLNContract.members.get(UInt64.from(identityCommitmentAlice));
            expect(memberAlice?.address.toJSON()).toBe(alice.toJSON());
            memberAlice?.index.value.assertEquals(identityCommitmentBeforeAlice);
            expect(memberAlice?.messageLimit.value.toBigInt()).toBe(BigInt(messageLimitAlice));

            // Bob: Add Balance
            const balanceMRLNBeforeBob = await appChain.query.runtime.Balances.balances.get(keyMRLN);
            if (balanceMRLNBeforeBob == undefined) {
                throw new Error("Balance MRLN Before is undefined");
            }
            expect(balanceMRLNBeforeBob.value.toString()).toBe(balanceMRLNAfterAlice.toString());

            const bobPrivateKey = PrivateKey.random();
            const bob = bobPrivateKey.toPublicKey();
            appChain.setSigner(bobPrivateKey);

            const registerAmountBob = BigInt(messageLimitBob) * minimalDeposit.toBigInt();

            const tx5 = await appChain.transaction(bob, () => {
                balances.addBalance(tokenId, bob, UInt64.from(registerAmountBob));
            });
            await tx5.sign();
            await tx5.send();
            const block5 = await appChain.produceBlock();
            block5?.transactions[0].status.assertEquals(true);

            const keyBob = new BalancesKey({ tokenId, address: bob });
            const balanceBobBefore = await appChain.query.runtime.Balances.balances.get(keyBob);
            if (balanceBobBefore == undefined) {
                throw new Error("Balance Bob Before is undefined")
            }

            // Bob: Register
            const identityCommitmentBeforeBob = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();
            if (identityCommitmentBeforeBob == undefined) {
                throw new Error("identityCommitmentBeforeBob is undefined");
            }
            const tx6 = await appChain.transaction(bob, () => {
                mrln.register(UInt64.from(identityCommitmentBob), UInt64.from(registerAmountBob));
            });
            await tx6.sign();
            await tx6.send();
            const block6 = await appChain.produceBlock();
            block6?.transactions[0].status.assertEquals(true);

            const balanceMRLNAfterBob = await appChain.query.runtime.Balances.balances.get(keyMRLN)
            if (balanceMRLNAfterBob == undefined) {
                throw new Error("Balance MRLN After Bob is undefined");
            }
            const tokenMRLNDiffBob = balanceMRLNAfterBob.value.sub(balanceMRLNBeforeBob.value);
            expect(tokenMRLNDiffBob.toString()).toBe(registerAmountBob.toString());

            const identityCommitmentAfterBob = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();
            identityCommitmentAfterBob?.assertEquals((identityCommitmentBeforeBob.add(new Field(1))));

            const balanceBobAfter = await appChain.query.runtime.Balances.balances.get(keyBob);
            if (balanceBobAfter == undefined) {
                throw new Error("Balance Bob After is undefined")
            }
            const tokenBobDiff = balanceBobBefore.value.sub(balanceBobAfter.value);
            expect(tokenBobDiff.toString()).toBe(registerAmountBob.toString());

            const memberBob = await appChain.query.runtime.MRLNContract.members.get(UInt64.from(identityCommitmentBob));
            expect(memberBob?.address.toJSON()).toBe(bob.toJSON());
            memberBob?.index.value.assertEquals(identityCommitmentBeforeBob);
            expect(memberBob?.messageLimit.value.toBigInt()).toBe(BigInt(messageLimitBob));

        }),
        it("test register fails when index exceeds set size", async () => {
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

            // MRLN: Init
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


            const tokenId = TokenId.from(0);

            // MRLN: Add Balance
            const tx2 = await appChain.transaction(alice, () => {
                balances.addBalance(tokenId, mrlnAddrState, UInt64.from(mrlnInitialTokenBalance));
            });
            await tx2.sign();
            await tx2.send();
            const block2 = await appChain.produceBlock();
            block2?.transactions[0].status.assertEquals(true);

            // Alice: Add Balance 
            const keyMRLN = new BalancesKey({ tokenId, address: mrlnAddrState });
            const balanceMRLNBeforeAlice = await appChain.query.runtime.Balances.balances.get(keyMRLN);
            if (balanceMRLNBeforeAlice == undefined) {
                throw new Error("Balance MRLN Before is undefined");
            }
            expect(balanceMRLNBeforeAlice.value.toString()).toBe(mrlnInitialTokenBalance.toString());

            const registerAmountAlice = BigInt(messageLimitAlice) * minimalDeposit.toBigInt();

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
                throw new Error("Balance Alice Before is undefined")
            }

            // Alice: Register 
            const identityCommitmentBeforeAlice = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();
            if (identityCommitmentBeforeAlice == undefined) {
                throw new Error("identityCommitmentBeforeAlice is undefined");
            }
            const tx4 = await appChain.transaction(alice, () => {
                mrln.register(UInt64.from(identityCommitmentAlice), UInt64.from(registerAmountAlice));
            });
            await tx4.sign();
            await tx4.send();
            const block4 = await appChain.produceBlock();
            block4?.transactions[0].status.assertEquals(true);

            const balanceMRLNAfterAlice = await appChain.query.runtime.Balances.balances.get(keyMRLN)
            if (balanceMRLNAfterAlice == undefined) {
                throw new Error("Balance MRLN After is undefined");
            }
            const tokenMRLNDiffAlice = balanceMRLNAfterAlice.value.sub(balanceMRLNBeforeAlice.value);
            expect(tokenMRLNDiffAlice.toString()).toBe(registerAmountAlice.toString());

            const identityCommitmentAfterAlice = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();
            identityCommitmentAfterAlice?.assertEquals((identityCommitmentBeforeAlice.add(new Field(1))));

            const balanceAliceAfter = await appChain.query.runtime.Balances.balances.get(keyAlice);
            if (balanceAliceAfter == undefined) {
                throw new Error("Balance Alice After is undefined")
            }
            const tokenAliceDiff = balanceAliceBefore.value.sub(balanceAliceAfter.value);
            expect(tokenAliceDiff.toString()).toBe(registerAmountAlice.toString());

            const memberAlice = await appChain.query.runtime.MRLNContract.members.get(UInt64.from(identityCommitmentAlice));
            expect(memberAlice?.address.toJSON()).toBe(alice.toJSON());
            memberAlice?.index.value.assertEquals(identityCommitmentBeforeAlice);
            expect(memberAlice?.messageLimit.value.toBigInt()).toBe(BigInt(messageLimitAlice));

            // Bob: Add Balance
            const balanceMRLNBeforeBob = await appChain.query.runtime.Balances.balances.get(keyMRLN);
            if (balanceMRLNBeforeBob == undefined) {
                throw new Error("Balance MRLN Before is undefined");
            }
            expect(balanceMRLNBeforeBob.value.toString()).toBe(balanceMRLNAfterAlice.toString());

            const bobPrivateKey = PrivateKey.random();
            const bob = bobPrivateKey.toPublicKey();
            appChain.setSigner(bobPrivateKey);

            const registerAmountBob = BigInt(messageLimitBob) * minimalDeposit.toBigInt();

            const tx5 = await appChain.transaction(bob, () => {
                balances.addBalance(tokenId, bob, UInt64.from(registerAmountBob));
            });
            await tx5.sign();
            await tx5.send();
            const block5 = await appChain.produceBlock();
            block5?.transactions[0].status.assertEquals(true);

            const keyBob = new BalancesKey({ tokenId, address: bob });
            const balanceBobBefore = await appChain.query.runtime.Balances.balances.get(keyBob);
            if (balanceBobBefore == undefined) {
                throw new Error("Balance Bob Before is undefined")
            }

            // Bob: Register
            const identityCommitmentBeforeBob = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();
            if (identityCommitmentBeforeBob == undefined) {
                throw new Error("identityCommitmentBeforeBob is undefined");
            }
            const tx6 = await appChain.transaction(bob, () => {
                mrln.register(UInt64.from(identityCommitmentBob), UInt64.from(registerAmountBob));
            });
            await tx6.sign();
            await tx6.send();
            const block6 = await appChain.produceBlock();
            block6?.transactions[0].status.assertEquals(true);

            const balanceMRLNAfterBob = await appChain.query.runtime.Balances.balances.get(keyMRLN)
            if (balanceMRLNAfterBob == undefined) {
                throw new Error("Balance MRLN After Bob is undefined");
            }
            const tokenMRLNDiffBob = balanceMRLNAfterBob.value.sub(balanceMRLNBeforeBob.value);
            expect(tokenMRLNDiffBob.toString()).toBe(registerAmountBob.toString());

            const identityCommitmentAfterBob = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();
            identityCommitmentAfterBob?.assertEquals((identityCommitmentBeforeBob.add(new Field(1))));

            const balanceBobAfter = await appChain.query.runtime.Balances.balances.get(keyBob);
            if (balanceBobAfter == undefined) {
                throw new Error("Balance Bob After is undefined")
            }
            const tokenBobDiff = balanceBobBefore.value.sub(balanceBobAfter.value);
            expect(tokenBobDiff.toString()).toBe(registerAmountBob.toString());

            const memberBob = await appChain.query.runtime.MRLNContract.members.get(UInt64.from(identityCommitmentBob));
            expect(memberBob?.address.toJSON()).toBe(bob.toJSON());
            memberBob?.index.value.assertEquals(identityCommitmentBeforeBob);
            expect(memberBob?.messageLimit.value.toBigInt()).toBe(BigInt(messageLimitBob));

            // Eve: Add Balance
            const balanceMRLNBeforeEve = await appChain.query.runtime.Balances.balances.get(keyMRLN);
            if (balanceMRLNBeforeEve == undefined) {
                throw new Error("Balance MRLN Before is undefined");
            }
            expect(balanceMRLNBeforeEve.value.toString()).toBe(balanceMRLNAfterBob.toString());

            const evePrivateKey = PrivateKey.random();
            const eve = evePrivateKey.toPublicKey();
            appChain.setSigner(evePrivateKey);

            const tx7 = await appChain.transaction(eve, () => {
                balances.addBalance(tokenId, bob, UInt64.from(registerAmountBob));
            });
            await tx7.sign();
            await tx7.send();
            const block7 = await appChain.produceBlock();
            block7?.transactions[0].status.assertEquals(true);

            const keyEve = new BalancesKey({ tokenId, address: eve });
            const balanceEveBefore = await appChain.query.runtime.Balances.balances.get(keyEve);
            if (balanceEveBefore == undefined) {
                throw new Error("Balance Eve Before is undefined")
            }

            // Eve: Register
            const identityCommitmentBeforeEve = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();
            if (identityCommitmentBeforeEve == undefined) {
                throw new Error("identityCommitmentBeforeEve is undefined");
            }
            const tx8 = await appChain.transaction(eve, () => {
                mrln.register(UInt64.from(9999), UInt64.from(minimalDeposit));
            });
            await tx8.sign();
            await tx8.send();
            const block8 = await appChain.produceBlock();
            //TODO: assertion message check?
            block8?.transactions[0].status.assertEquals(false);
        }),
        it("test register fails when amount less than minimal deposit", async () => {
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

            // MRLN: Init
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


            const tokenId = TokenId.from(0);

            // MRLN: Add Balance
            const tx2 = await appChain.transaction(alice, () => {
                balances.addBalance(tokenId, mrlnAddrState, UInt64.from(mrlnInitialTokenBalance));
            });
            await tx2.sign();
            await tx2.send();
            const block2 = await appChain.produceBlock();
            block2?.transactions[0].status.assertEquals(true);

            // Alice: Add Balance 
            const keyMRLN = new BalancesKey({ tokenId, address: mrlnAddrState });
            const balanceMRLNBeforeAlice = await appChain.query.runtime.Balances.balances.get(keyMRLN);
            if (balanceMRLNBeforeAlice == undefined) {
                throw new Error("Balance MRLN Before is undefined");
            }
            expect(balanceMRLNBeforeAlice.value.toString()).toBe(mrlnInitialTokenBalance.toString());

            const insufficientRegisterAmountAlice = minimalDeposit.toBigInt() - BigInt(1);

            const tx3 = await appChain.transaction(alice, () => {
                balances.addBalance(tokenId, alice, UInt64.from(insufficientRegisterAmountAlice));
            });
            await tx3.sign();
            await tx3.send();
            const block3 = await appChain.produceBlock();
            block3?.transactions[0].status.assertEquals(true);

            const keyAlice = new BalancesKey({ tokenId, address: alice });
            const balanceAliceBefore = await appChain.query.runtime.Balances.balances.get(keyAlice);
            if (balanceAliceBefore == undefined) {
                throw new Error("Balance Alice Before is undefined")
            }

            // Alice: Register 
            const identityCommitmentBeforeAlice = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();
            if (identityCommitmentBeforeAlice == undefined) {
                throw new Error("identityCommitmentBeforeAlice is undefined");
            }
            const tx4 = await appChain.transaction(alice, () => {
                mrln.register(UInt64.from(identityCommitmentAlice), UInt64.from(insufficientRegisterAmountAlice));
            });
            await tx4.sign();
            await tx4.send();
            const block4 = await appChain.produceBlock();
            //TODO: assertion message check?
            block4?.transactions[0].status.assertEquals(false);
        }),
        it("test register fails when duplicate identity commitments", async () => {
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

            // MRLN: Init
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


            const tokenId = TokenId.from(0);

            // MRLN: Add Balance
            const tx2 = await appChain.transaction(alice, () => {
                balances.addBalance(tokenId, mrlnAddrState, UInt64.from(mrlnInitialTokenBalance));
            });
            await tx2.sign();
            await tx2.send();
            const block2 = await appChain.produceBlock();
            block2?.transactions[0].status.assertEquals(true);

            // Alice: Add Balance 
            const keyMRLN = new BalancesKey({ tokenId, address: mrlnAddrState });
            const balanceMRLNBeforeAlice = await appChain.query.runtime.Balances.balances.get(keyMRLN);
            if (balanceMRLNBeforeAlice == undefined) {
                throw new Error("Balance MRLN Before is undefined");
            }
            expect(balanceMRLNBeforeAlice.value.toString()).toBe(mrlnInitialTokenBalance.toString());

            const registerAmountAlice = BigInt(messageLimitAlice) * minimalDeposit.toBigInt();

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
                throw new Error("Balance Alice Before is undefined")
            }

            // Alice: Register 
            const identityCommitmentBeforeAlice = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();
            if (identityCommitmentBeforeAlice == undefined) {
                throw new Error("identityCommitmentBeforeAlice is undefined");
            }
            const tx4 = await appChain.transaction(alice, () => {
                mrln.register(UInt64.from(identityCommitmentAlice), UInt64.from(registerAmountAlice));
            });
            await tx4.sign();
            await tx4.send();
            const block4 = await appChain.produceBlock();
            block4?.transactions[0].status.assertEquals(true);

            const balanceMRLNAfterAlice = await appChain.query.runtime.Balances.balances.get(keyMRLN)
            if (balanceMRLNAfterAlice == undefined) {
                throw new Error("Balance MRLN After is undefined");
            }
            const tokenMRLNDiffAlice = balanceMRLNAfterAlice.value.sub(balanceMRLNBeforeAlice.value);
            expect(tokenMRLNDiffAlice.toString()).toBe(registerAmountAlice.toString());

            const identityCommitmentAfterAlice = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();
            identityCommitmentAfterAlice?.assertEquals((identityCommitmentBeforeAlice.add(new Field(1))));

            const balanceAliceAfter = await appChain.query.runtime.Balances.balances.get(keyAlice);
            if (balanceAliceAfter == undefined) {
                throw new Error("Balance Alice After is undefined")
            }
            const tokenAliceDiff = balanceAliceBefore.value.sub(balanceAliceAfter.value);
            expect(tokenAliceDiff.toString()).toBe(registerAmountAlice.toString());

            const memberAlice = await appChain.query.runtime.MRLNContract.members.get(UInt64.from(identityCommitmentAlice));
            expect(memberAlice?.address.toJSON()).toBe(alice.toJSON());
            memberAlice?.index.value.assertEquals(identityCommitmentBeforeAlice);
            expect(memberAlice?.messageLimit.value.toBigInt()).toBe(BigInt(messageLimitAlice));

            // Bob: Add Balance
            const balanceMRLNBeforeBob = await appChain.query.runtime.Balances.balances.get(keyMRLN);
            if (balanceMRLNBeforeBob == undefined) {
                throw new Error("Balance MRLN Before is undefined");
            }
            expect(balanceMRLNBeforeBob.value.toString()).toBe(balanceMRLNAfterAlice.toString());

            const bobPrivateKey = PrivateKey.random();
            const bob = bobPrivateKey.toPublicKey();
            appChain.setSigner(bobPrivateKey);

            const registerAmountBob = BigInt(messageLimitBob) * minimalDeposit.toBigInt();

            const tx5 = await appChain.transaction(bob, () => {
                balances.addBalance(tokenId, bob, UInt64.from(registerAmountBob));
            });
            await tx5.sign();
            await tx5.send();
            const block5 = await appChain.produceBlock();
            block5?.transactions[0].status.assertEquals(true);

            const keyBob = new BalancesKey({ tokenId, address: bob });
            const balanceBobBefore = await appChain.query.runtime.Balances.balances.get(keyBob);
            if (balanceBobBefore == undefined) {
                throw new Error("Balance Bob Before is undefined")
            }

            // Bob: Register with Alice's identityCommitment
            const identityCommitmentBeforeBob = await appChain.query.runtime.MRLNContract.identityCommitmentIndex.get();
            if (identityCommitmentBeforeBob == undefined) {
                throw new Error("identityCommitmentBeforeBob is undefined");
            }
            const tx6 = await appChain.transaction(bob, () => {
                mrln.register(UInt64.from(identityCommitmentAlice), UInt64.from(registerAmountBob));
            });
            await tx6.sign();
            await tx6.send();
            const block6 = await appChain.produceBlock();
            expect(block6?.transactions[0].statusMessage).toBe('MRLN: idCommitment already registered');
            block6?.transactions[0].status.assertEquals(false);
        })
})
