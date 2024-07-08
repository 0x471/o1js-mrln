import { TestingAppChain } from "@proto-kit/sdk";
import { Bool, Field, Poseidon, PublicKey } from "o1js";
import { PrivateKey } from "o1js";
import { Balances } from "../src/balances";
import { MRLNContract, dummyProof } from "../src/mrln";
import { log, EMPTY_PUBLICKEY } from "@proto-kit/common";
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
const identityCommitmentCarol = 9012;

const messageLimitAlice = 2;
const messageLimitBob = 3;
const messageLimitCarol = 4;


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
        }),
        it("test withdraw succeeds", async () => {
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

            // Alice: Withdraw

            const memberAlice = await appChain.query.runtime.MRLNContract.members.get(UInt64.from(identityCommitmentAlice));
            expect(memberAlice?.address.toJSON()).toBe(alice.toJSON());
            memberAlice?.index.value.assertEquals(identityCommitmentBeforeAlice);
            expect(memberAlice?.messageLimit.value.toBigInt()).toBe(BigInt(messageLimitAlice));

            const tx5 = await appChain.transaction(alice, () => {
                mrln.withdraw(UInt64.from(identityCommitmentAlice), dummyProof);
            });
            await tx5.sign();
            await tx5.send();
            const block5 = await appChain.produceBlock();
            block5?.transactions[0].status.assertEquals(true);
            if (block5 == undefined) {
                throw new Error("block5 is undefined")
            }

            const withdrawalAlice = await appChain.query.runtime.MRLNContract.withdrawals.get(UInt64.from(identityCommitmentAlice));
            if (withdrawalAlice == undefined) {
                throw new Error("Withdrawal Alice is undefined")
            }
            expect(withdrawalAlice?.amount.value.toString()).toBe(registerAmountAlice.toString());
            expect(withdrawalAlice?.blockNumber.value.toString()).toBe(block5.height.toString());
            expect(withdrawalAlice?.receiver.toJSON()).toBe(alice.toJSON());
        }),
        it("test withdraw fails when not registered", async () => {
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

            const tx4 = await appChain.transaction(alice, () => {
                mrln.withdraw(UInt64.from(identityCommitmentAlice), dummyProof);
            });
            await tx4.sign();
            await tx4.send();
            const block4 = await appChain.produceBlock();
            expect(block4?.transactions[0].statusMessage).toBe('MRLN: member does not exist');
            block4?.transactions[0].status.assertEquals(false);
        }),
        it("test withdraw fails when already underways", async () => {
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

            // Alice: Withdraw

            const memberAlice = await appChain.query.runtime.MRLNContract.members.get(UInt64.from(identityCommitmentAlice));
            expect(memberAlice?.address.toJSON()).toBe(alice.toJSON());
            memberAlice?.index.value.assertEquals(identityCommitmentBeforeAlice);
            expect(memberAlice?.messageLimit.value.toBigInt()).toBe(BigInt(messageLimitAlice));

            const tx5 = await appChain.transaction(alice, () => {
                mrln.withdraw(UInt64.from(identityCommitmentAlice), dummyProof);
            });
            await tx5.sign();
            await tx5.send();
            const block5 = await appChain.produceBlock();
            block5?.transactions[0].status.assertEquals(true);
            if (block5 == undefined) {
                throw new Error("block5 is undefined")
            }

            const withdrawalAlice = await appChain.query.runtime.MRLNContract.withdrawals.get(UInt64.from(identityCommitmentAlice));
            if (withdrawalAlice == undefined) {
                throw new Error("Withdrawal Alice is undefined")
            }
            expect(withdrawalAlice?.amount.value.toString()).toBe(registerAmountAlice.toString());
            expect(withdrawalAlice?.blockNumber.value.toString()).toBe(block5.height.toString());
            expect(withdrawalAlice?.receiver.toJSON()).toBe(alice.toJSON());

            // Alice: Withdraw again (such withdrawal already exists)
            const tx6 = await appChain.transaction(alice, () => {
                mrln.withdraw(UInt64.from(identityCommitmentAlice), dummyProof);
            });
            await tx6.sign();
            await tx6.send();
            const block6 = await appChain.produceBlock();
            expect(block6?.transactions[0].statusMessage).toBe('MRLN: such withdrawal exists');
            block6?.transactions[0].status.assertEquals(false);
        }),
        it("test release succeeds", async () => {
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
                balances.addBalance(tokenId, alice, UInt64.from(registerAmountAlice * BigInt(2)));
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

            // Alice: Withdraw
            const memberAlice = await appChain.query.runtime.MRLNContract.members.get(UInt64.from(identityCommitmentAlice));
            expect(memberAlice?.address.toJSON()).toBe(alice.toJSON());
            memberAlice?.index.value.assertEquals(identityCommitmentBeforeAlice);
            expect(memberAlice?.messageLimit.value.toBigInt()).toBe(BigInt(messageLimitAlice));

            const tx5 = await appChain.transaction(alice, () => {
                mrln.withdraw(UInt64.from(identityCommitmentAlice), dummyProof);
            });
            await tx5.sign();
            await tx5.send();
            const block5 = await appChain.produceBlock();
            block5?.transactions[0].status.assertEquals(true);
            if (block5 == undefined) {
                throw new Error("block5 is undefined")
            }

            const withdrawalAlice = await appChain.query.runtime.MRLNContract.withdrawals.get(UInt64.from(identityCommitmentAlice));
            if (withdrawalAlice == undefined) {
                throw new Error("Withdrawal Alice is undefined")
            }

            expect(withdrawalAlice?.amount.value.toString()).toBe(registerAmountAlice.toString());
            expect(withdrawalAlice?.blockNumber.value.toString()).toBe(block5.height.toString());
            expect(withdrawalAlice?.receiver.toJSON()).toBe(alice.toJSON());

            // Alice: Release
            const blockNumbersToRelease = block5.height.toBigInt() + freezePeriod.toBigInt() + BigInt(1);
            for (let i = BigInt(0); i < blockNumbersToRelease; i++) {
                await appChain.sequencer.resolve("BlockTrigger").produceUnproven();
            }
            const balanceAliceBeforeRelease = await appChain.query.runtime.Balances.balances.get(keyAlice);
            if (balanceAliceBeforeRelease == undefined) {
                throw new Error("Balance Alice Before Release is undefined");
            }

            const balanceMRLNBeforeRelease = await appChain.query.runtime.Balances.balances.get(keyMRLN);
            if (balanceMRLNBeforeRelease == undefined) {
                throw new Error("Balance MRLN Before Release is undefined");
            }
            const height = await appChain.query.network.unproven.then((x) => {
                return x?.block.height.value;
            });

            const tx6 = await appChain.transaction(alice, () => {
                mrln.release(UInt64.from(identityCommitmentAlice));
            });
            await tx6.sign();
            await tx6.send();
            const block6 = await appChain.produceBlock();
            block6?.transactions[0].status.assertEquals(true);
            if (block6 == undefined) {
                throw new Error("block6 is undefined")
            }

            const expectedBalanceDiff = registerAmountAlice;

            const balanceMRLNAfterRelease = await appChain.query.runtime.Balances.balances.get(keyMRLN)
            if (balanceMRLNAfterRelease == undefined) {
                throw new Error("Balance MRLN After Release is undefined");
            }

            const balanceMRLNDiffRelease = UInt64.from(balanceMRLNBeforeRelease.value).sub(balanceMRLNAfterRelease);
            if (balanceMRLNDiffRelease == undefined) {
                throw new Error("Balance MRLN Diff Release is undefined");
            }
            expect(balanceMRLNDiffRelease.toString()).toBe(expectedBalanceDiff.toString());


            const balanceAliceAfterRelease = await appChain.query.runtime.Balances.balances.get(keyAlice);
            if (balanceAliceAfterRelease == undefined) {
                throw new Error("Balance Alice After Release is undefined");
            }

            const balanceAliceDiffRelease = UInt64.from(balanceAliceAfterRelease.value).sub(balanceAliceBeforeRelease);
            expect(balanceAliceDiffRelease.toString()).toBe(expectedBalanceDiff.toString());

            // Check user (Alice) is deleted

            // Alice user state
            const aliceStateAfterRelease = await appChain.query.runtime.MRLNContract.members.get(UInt64.from(identityCommitmentAlice));
            if (aliceStateAfterRelease == undefined) {
                throw new Error("Alice state after release is undefined")
            }
            expect(aliceStateAfterRelease.address.toJSON()).toBe(EMPTY_PUBLICKEY.toJSON());
            expect(aliceStateAfterRelease.messageLimit.value.toString()).toBe(new Field(0).toString());
            expect(aliceStateAfterRelease.index.value.toString()).toBe(new Field(0).toString());

            // Alice withdrawal state
            const aliceWithdrawalAfterRelease = await appChain.query.runtime.MRLNContract.withdrawals.get(UInt64.from(identityCommitmentAlice));
            if (aliceWithdrawalAfterRelease == undefined) {
                throw new Error("Alice withdrawal state after release is undefined")
            }
            expect(aliceWithdrawalAfterRelease.amount.value.toString()).toBe(new Field(0).toString())
            expect(aliceWithdrawalAfterRelease.blockNumber.value.toString()).toBe(new Field(0).toString());
            expect(aliceWithdrawalAfterRelease.receiver.toJSON()).toBe(EMPTY_PUBLICKEY.toJSON());

        }),
        it("test release fails when no withdrawal", async () => {
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
                balances.addBalance(tokenId, alice, UInt64.from(registerAmountAlice * BigInt(2)));
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

            // Alice: Release
            const tx6 = await appChain.transaction(alice, () => {
                mrln.release(UInt64.from(identityCommitmentAlice));
            });
            await tx6.sign();
            await tx6.send();
            const block6 = await appChain.produceBlock();
            expect(block6?.transactions[0].statusMessage).toBe('MRLN: no such withdrawals');
            block6?.transactions[0].status.assertEquals(false);
        }),
        it("test release fails when freeze period", async () => {
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
                balances.addBalance(tokenId, alice, UInt64.from(registerAmountAlice * BigInt(2)));
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

            // Alice: Withdraw
            const memberAlice = await appChain.query.runtime.MRLNContract.members.get(UInt64.from(identityCommitmentAlice));
            expect(memberAlice?.address.toJSON()).toBe(alice.toJSON());
            memberAlice?.index.value.assertEquals(identityCommitmentBeforeAlice);
            expect(memberAlice?.messageLimit.value.toBigInt()).toBe(BigInt(messageLimitAlice));

            const tx5 = await appChain.transaction(alice, () => {
                mrln.withdraw(UInt64.from(identityCommitmentAlice), dummyProof);
            });
            await tx5.sign();
            await tx5.send();
            const block5 = await appChain.produceBlock();
            block5?.transactions[0].status.assertEquals(true);
            if (block5 == undefined) {
                throw new Error("block5 is undefined")
            }

            const withdrawalAlice = await appChain.query.runtime.MRLNContract.withdrawals.get(UInt64.from(identityCommitmentAlice));
            if (withdrawalAlice == undefined) {
                throw new Error("Withdrawal Alice is undefined")
            }

            expect(withdrawalAlice?.amount.value.toString()).toBe(registerAmountAlice.toString());
            expect(withdrawalAlice?.blockNumber.value.toString()).toBe(block5.height.toString());
            expect(withdrawalAlice?.receiver.toJSON()).toBe(alice.toJSON());

            // Alice: withdraw (tx should fail)
            const tx6 = await appChain.transaction(alice, () => {
                mrln.release(UInt64.from(identityCommitmentAlice));
            });
            await tx6.sign();
            await tx6.send();
            const block6 = await appChain.produceBlock();
            expect(block6?.transactions[0].statusMessage).toBe('MRLN: cannot release yet');
            block6?.transactions[0].status.assertEquals(false);
        }),
        it("test slash succeeds", async () => {
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

            // Bob: Init
            const bobPrivateKey = PrivateKey.random();
            const bob = bobPrivateKey.toPublicKey();
            const keyBob = new BalancesKey({ tokenId, address: bob });

            // Alice: Slash
            const keyFeeReceiver = new BalancesKey({ tokenId, address: feeReceiver });

            let balanceBobBeforeSlash = await appChain.query.runtime.Balances.balances.get(keyBob);
            if (balanceBobBeforeSlash == undefined) {
                balanceBobBeforeSlash = UInt64.from(0);
            }

            const balanceMRLNBeforeSlash = await appChain.query.runtime.Balances.balances.get(keyMRLN);
            if (balanceMRLNBeforeSlash == undefined) {
                throw new Error("Balance MRLN Before Slash is undefined");
            }

            let balanceFeeReceiverBeforeSlash = await appChain.query.runtime.Balances.balances.get(keyFeeReceiver);
            if (balanceFeeReceiverBeforeSlash == undefined) {
                balanceFeeReceiverBeforeSlash = UInt64.from(0);
            }

            const tx5 = await appChain.transaction(alice, () => {
                mrln.slash(UInt64.from(identityCommitmentAlice), bob, dummyProof);
            });
            await tx5.sign();
            await tx5.send();
            const block5 = await appChain.produceBlock();
            block5?.transactions[0].status.assertEquals(true);

            const balanceBobAfterSlash = await appChain.query.runtime.Balances.balances.get(keyBob);
            if (balanceBobAfterSlash == undefined) {
                throw new Error("Balance Bob After Slash is undefined")
            }
            const balanceMRLNAfterSlash = await appChain.query.runtime.Balances.balances.get(keyMRLN);
            if (balanceMRLNAfterSlash == undefined) {
                throw new Error("Balance MRLN After Slash is undefined");
            }

            const balanceFeeReceiverAfterSlash = await appChain.query.runtime.Balances.balances.get(keyFeeReceiver);
            if (balanceFeeReceiverAfterSlash == undefined) {
                throw new Error("Balance Fee Receiver After Slash is undefined");
            }
            const bobBalanceDiff = balanceBobAfterSlash.value.sub(balanceBobBeforeSlash.value);
            const MRLNBalanceDiff = balanceMRLNBeforeSlash.value.sub(balanceMRLNAfterSlash.value);
            const feeReceiverBalanceDiff = balanceFeeReceiverAfterSlash.value.sub(balanceFeeReceiverBeforeSlash.value);

            const slashFee = registerAmountAlice * feePercentage.toBigInt() / BigInt(100)
            const slashReward = registerAmountAlice - slashFee;

            expect(bobBalanceDiff.toString()).toBe(slashReward.toString());
            expect(MRLNBalanceDiff.toString()).toBe(registerAmountAlice.toString());
            expect(feeReceiverBalanceDiff.toString()).toBe(slashFee.toString());

            // Check user (Alice) is deleted

            // Alice user state
            const aliceStateAfterRelease = await appChain.query.runtime.MRLNContract.members.get(UInt64.from(identityCommitmentAlice));
            if (aliceStateAfterRelease == undefined) {
                throw new Error("Alice state after release is undefined")
            }
            expect(aliceStateAfterRelease.address.toJSON()).toBe(EMPTY_PUBLICKEY.toJSON());
            expect(aliceStateAfterRelease.messageLimit.value.toString()).toBe(new Field(0).toString());
            expect(aliceStateAfterRelease.index.value.toString()).toBe(new Field(0).toString());

            // Alice withdrawal state
            const aliceWithdrawalAfterRelease = await appChain.query.runtime.MRLNContract.withdrawals.get(UInt64.from(identityCommitmentAlice));
            if (aliceWithdrawalAfterRelease == undefined) {
                throw new Error("Alice withdrawal state after release is undefined")
            }
            expect(aliceWithdrawalAfterRelease.amount.value.toString()).toBe(new Field(0).toString())
            expect(aliceWithdrawalAfterRelease.blockNumber.value.toString()).toBe(new Field(0).toString());
            expect(aliceWithdrawalAfterRelease.receiver.toJSON()).toBe(EMPTY_PUBLICKEY.toJSON());


            // Test: register, withdraw, ang get slashed before release
            const carolPrivateKey = PrivateKey.random();
            const carol = carolPrivateKey.toPublicKey();
            appChain.setSigner(carolPrivateKey);
            const registerAmountCarol = BigInt(messageLimitCarol) * minimalDeposit.toBigInt();

            const tx6 = await appChain.transaction(carol, () => {
                balances.addBalance(tokenId, carol, UInt64.from(registerAmountCarol * BigInt(2)));
            });
            await tx6.sign();
            await tx6.send();
            const block6 = await appChain.produceBlock();
            block6?.transactions[0].status.assertEquals(true);

            const tx7 = await appChain.transaction(carol, () => {
                mrln.register(UInt64.from(identityCommitmentCarol), UInt64.from(registerAmountCarol));
            });
            await tx7.sign();
            await tx7.send();
            const block7 = await appChain.produceBlock();
            block7?.transactions[0].status.assertEquals(true);

            const tx8 = await appChain.transaction(carol, () => {
                mrln.withdraw(UInt64.from(identityCommitmentCarol), dummyProof);
            });
            await tx8.sign();
            await tx8.send();
            const block8 = await appChain.produceBlock();
            block8?.transactions[0].status.assertEquals(true);


            const tx9 = await appChain.transaction(carol, () => {
                mrln.slash(UInt64.from(identityCommitmentCarol), alice, dummyProof);
            });
            await tx9.sign();
            await tx9.send();
            const block9 = await appChain.produceBlock();
            block9?.transactions[0].status.assertEquals(true);

            // Check user (Carol) is deleted

            // Carol user state
            const carolStateAfterRelease = await appChain.query.runtime.MRLNContract.members.get(UInt64.from(identityCommitmentCarol));
            if (carolStateAfterRelease == undefined) {
                throw new Error("Carol state after slash is undefined")
            }
            expect(carolStateAfterRelease.address.toJSON()).toBe(EMPTY_PUBLICKEY.toJSON());
            expect(carolStateAfterRelease.messageLimit.value.toString()).toBe(new Field(0).toString());
            expect(carolStateAfterRelease.index.value.toString()).toBe(new Field(0).toString());

            // Carol withdrawal state
            const carolWithdrawalAfterRelease = await appChain.query.runtime.MRLNContract.withdrawals.get(UInt64.from(identityCommitmentCarol));
            if (carolWithdrawalAfterRelease == undefined) {
                throw new Error("Carol withdrawal state after slash is undefined")
            }
            expect(carolWithdrawalAfterRelease.amount.value.toString()).toBe(new Field(0).toString())
            expect(carolWithdrawalAfterRelease.blockNumber.value.toString()).toBe(new Field(0).toString());
            expect(carolWithdrawalAfterRelease.receiver.toJSON()).toBe(EMPTY_PUBLICKEY.toJSON());
        }), 
        it("test slash fails when receiver is zero", async () => {
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

            // Alice: Slash (receiver is zero)
            const tx5 = await appChain.transaction(alice, () => {
                mrln.slash(UInt64.from(identityCommitmentAlice), EMPTY_PUBLICKEY, dummyProof);
            });
            await tx5.sign();
            await tx5.send();
            const block5 = await appChain.produceBlock();
            expect(block5?.transactions[0].statusMessage).toBe('MRLN: empty receiver address');
            block5?.transactions[0].status.assertEquals(false);

        }),
        it("test slash fails when not registered", async () => {
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

            const bobPrivateKey = PrivateKey.random();
            const bob = bobPrivateKey.toPublicKey();
            const tx2 = await appChain.transaction(alice, () => {
                mrln.slash(UInt64.from(identityCommitmentAlice), bob, dummyProof)
            })

            await tx2.sign();
            await tx2.send();
            const block2 = await appChain.produceBlock();
            expect(block2?.transactions[0].statusMessage).toBe('MRLN: member does not exist');
            block2?.transactions[0].status.assertEquals(false)
        }),
        it("test slash fails when self slashing", async () => {
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

            // Alice: Slash (self)
            const tx5 = await appChain.transaction(alice, () => {
                mrln.slash(UInt64.from(identityCommitmentAlice), alice, dummyProof);
            });
            await tx5.sign();
            await tx5.send();
            const block5 = await appChain.produceBlock();
            expect(block5?.transactions[0].statusMessage).toBe('MRLN: self-slashing is prohibited');
            block5?.transactions[0].status.assertEquals(false);
        })
})
