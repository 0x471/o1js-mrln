import {
    RuntimeModule,
    runtimeModule,
    runtimeMethod,
    state,
} from "@proto-kit/module";
import { State, StateMap, assert } from "@proto-kit/protocol";
import { UInt64, TokenId, UInt224 } from "@proto-kit/library"
import "reflect-metadata";
import { inject } from "tsyringe";
import {
    Experimental,
    Field,
    MerkleWitness,
    Poseidon,
    Struct,
    PublicKey,
    Provable,
    Bool,
} from "o1js";
import { Balances } from "./balances";
import { Pickles } from "o1js/dist/node/snarky";
import { dummyBase64Proof } from "o1js/dist/node/lib/proof_system";

export const TREE_HEIGHT = 20;
export class TreeWitness extends MerkleWitness(TREE_HEIGHT) { }

export class MRLNCircuitPublicOutput extends Struct({
    y: Field,
    root: Field,
    nullifier: Field
}) { }

export class MRLNCircuitPublicInput extends Struct({
    x: Field,
    externalNullifier: Field
}) { }

export function RLN(
    publicInput: MRLNCircuitPublicInput,
    identitySecret: Field,
    userMessageLimit: Field,
    messageId: Field,
    witness: TreeWitness,
): MRLNCircuitPublicOutput {
    const identityCommitment = Poseidon.hash([identitySecret]);
    const rateCommitment = Poseidon.hash([identityCommitment, userMessageLimit]);

    // membership check
    const root = witness.calculateRoot(rateCommitment);

    // SSS share calculations
    const a1 = Poseidon.hash([identitySecret, publicInput.externalNullifier, messageId]);
    const y = a1.mul(publicInput.x).add(identitySecret);

    // nullifier calculation
    const nullifier = Poseidon.hash([a1]);

    return new MRLNCircuitPublicOutput({
        y: y,
        root: root,
        nullifier: nullifier
    });
}

export const MRLNCircuit = Experimental.ZkProgram({
    publicOutput: MRLNCircuitPublicOutput,
    publicInput: MRLNCircuitPublicInput,
    methods: {
        canClaim: {
            privateInputs: [Field, Field, Field, TreeWitness],
            method: RLN,
        },
    },
});

// Dummy Proof
class MRLNProof extends Experimental.ZkProgram.Proof(MRLNCircuit) { }
const canClaim = (x: Field, externalNullifier: Field) => {
    return {
        y: new Field(1),
        root: new Field(2),
        nullifier: new Field(3)
    }
};
const [, dummy] = Pickles.proofOfBase64(await dummyBase64Proof(), 2);
const publicInput = {
    x: new Field(0),
    externalNullifier: new Field(1)
};
export const dummyProof = new MRLNProof({
    proof: dummy,
    publicOutput: canClaim(publicInput.x, publicInput.externalNullifier),
    publicInput,
    maxProofsVerified: 2,
});

export class User extends Struct({
    address: PublicKey,
    messageLimit: UInt64,
    index: UInt64
}) { }

export class Withdrawal extends Struct({
    blockNumber: UInt64,
    amount: UInt64,
    receiver: PublicKey
}) { }

export class MRLNContractConfig {
}
@runtimeModule()
export class MRLNContract extends RuntimeModule<MRLNContractConfig> {
    @state() public MINIMAL_DEPOSIT = State.from<Field>(Field);
    @state() public MAXIMAL_RATE = State.from<Field>(Field);
    @state() public SET_SIZE = State.from<Field>(Field);
    @state() public FEE_RECEIVER = State.from<PublicKey>(PublicKey);
    @state() public FEE_PERCENTAGE = State.from<Field>(Field);
    @state() public FREEZE_PERIOD = State.from<Field>(Field);
    @state() public MRLN_ADDRESS = State.from<PublicKey>(PublicKey);

    @state() public identityCommitmentIndex = State.from<Field>(Field);

    @state() public members = StateMap.from(UInt64, User)
    @state() public withdrawals = StateMap.from(UInt64, Withdrawal)

    // TODO: events?
    public constructor(@inject("Balances") public balances: Balances) {
        super();
    }

    @runtimeMethod()
    public init(addr: PublicKey,
        minimalDeposit: Field,
        maximalRate: Field,
        setSize: Field,
        feePercentage: Field,
        feeReceiver: PublicKey,
        freezePeriod: Field) {

        this.MRLN_ADDRESS.set(addr);
        this.MINIMAL_DEPOSIT.set(minimalDeposit);
        this.MAXIMAL_RATE.set(maximalRate);
        assert(feeReceiver.isEmpty().equals(false));
        this.SET_SIZE.set(setSize); // 1 << depth
        this.FEE_RECEIVER.set(feeReceiver);
        this.FEE_PERCENTAGE.set(feePercentage);
        this.FREEZE_PERIOD.set(freezePeriod);
        this.identityCommitmentIndex.set(new Field(0));
    }


    @runtimeMethod()
    public register(identityCommitment: UInt64, amount: UInt64) {
        const index = UInt64.from(this.identityCommitmentIndex.get().value);
        const SET_SIZE = UInt64.from(this.SET_SIZE.get().value);
        const MINIMAL_DEPOSIT = UInt64.from(this.MINIMAL_DEPOSIT.get().value);
        const shouldPad = MINIMAL_DEPOSIT.equals(0);
        const paddedDivisor = Provable.if(shouldPad, UInt64.from(1).value, MINIMAL_DEPOSIT.value);
        const MAXIMAL_RATE = UInt64.from(this.MAXIMAL_RATE.get().value);
        const tx_sender = this.transaction.sender.value;
        const addressMRLN = this.MRLN_ADDRESS.get().value;
        assert(index.lessThan(SET_SIZE), 'MRLN: set is full');
        assert(amount.greaterThanOrEqual(MINIMAL_DEPOSIT), 'MRLN: amount is lower than minimal deposit');
        assert(UInt64.from(amount.value).divMod(UInt64.from(paddedDivisor)).rest.value.equals(0));
        assert(this.members.get(identityCommitment).value.address.isEmpty().equals(true), 'MRLN: idCommitment already registered');
        const messageLimit = UInt64.from(amount.value).div(UInt64.from(paddedDivisor));
        assert(messageLimit.lessThanOrEqual(MAXIMAL_RATE), 'MRLN: message limit cannot be more than MAXIMAL_RATE');

        this.balances.addBalance(TokenId.from(0), addressMRLN, UInt64.from(amount.value));
        this.balances.removeBalance(TokenId.from(0), tx_sender, UInt64.from(amount.value));
        const member = new User({ address: tx_sender, messageLimit: messageLimit, index: index });
        this.members.set(identityCommitment, member);
        this.identityCommitmentIndex.set(this.identityCommitmentIndex.get().value.add(1));
    }

    @runtimeMethod()
    public withdraw(identityCommitment: UInt64, proof: MRLNProof) {
        const member = this.members.get(identityCommitment).value;
        assert(member.address.isEmpty().equals(false), 'MRLN: member does not exist');
        assert(this.withdrawals.get(identityCommitment).value.blockNumber.value.equals(UInt64.from(0).value), 'MRLN: such withdrawal exists');
        proof.verify();

        const withdrawAmount = UInt64.from(member.messageLimit.value).mul(UInt64.from(this.MINIMAL_DEPOSIT.get().value));
        const withdrawal = new Withdrawal({ blockNumber: UInt64.from(this.network.block.height), amount: withdrawAmount, receiver: member.address });
        this.withdrawals.set(identityCommitment, withdrawal);
    }

    @runtimeMethod()
    public release(identityCommitment: UInt64) {
        const FREEZE_PERIOD = this.FREEZE_PERIOD.get().value;
        const withdrawal = this.withdrawals.get(UInt64.from(identityCommitment.value)).value;
        const blockNumber = UInt64.from(withdrawal.blockNumber);
        assert(blockNumber.value.greaterThan(new Field(0)), 'MRLN: no such withdrawals');
        assert(UInt64.from(this.network.block.height).sub(blockNumber).greaterThan(UInt64.from(FREEZE_PERIOD)), 'MRLN: cannot release yet');

        const newWithdrawalState = new Withdrawal({ blockNumber: UInt64.from(0), amount: UInt64.from(0), receiver: PublicKey.empty() })
        this.withdrawals.set(identityCommitment, newWithdrawalState);

        const newMemberState = new User({ address: PublicKey.empty(), messageLimit: UInt64.from(0), index: UInt64.from(0) })
        this.members.set(identityCommitment, newMemberState);

        this.balances.addBalance(TokenId.from(0), withdrawal.receiver, withdrawal.amount);
        this.balances.removeBalance(TokenId.from(0), this.MRLN_ADDRESS.get().value, withdrawal.amount);
    }

    @runtimeMethod()
    public slash(identityCommitment: UInt64, receiver: PublicKey, proof: MRLNProof) {
        assert(receiver.isEmpty().equals(false));

        const member = this.members.get(identityCommitment).value;
        assert(member.address.isEmpty().equals(false));
        assert((member.address.equals(receiver)).equals(false));

        proof.verify();

        const newWithdrawalState = new Withdrawal({ blockNumber: UInt64.from(0), amount: UInt64.from(0), receiver: PublicKey.empty() })
        this.withdrawals.set(identityCommitment, newWithdrawalState);

        const newMemberState = new User({ address: PublicKey.empty(), messageLimit: UInt64.from(0), index: UInt64.from(0) })
        this.members.set(identityCommitment, newMemberState);

        const FEE_RECEIVER = this.FEE_RECEIVER.get().value;
        const FEE_PERCENTAGE = this.FEE_PERCENTAGE.get().value;

        const withdrawAmount = UInt64.from(member.messageLimit.value).mul(UInt64.from(this.MINIMAL_DEPOSIT.get().value));
        const feeAmount = (UInt64.from(FEE_PERCENTAGE).mul(withdrawAmount)).div(100);

        this.balances.addBalance(TokenId.from(0), receiver, withdrawAmount.sub(feeAmount));
        this.balances.addBalance(TokenId.from(0), FEE_RECEIVER, feeAmount);
        this.balances.removeBalance(TokenId.from(0), this.MRLN_ADDRESS.get().value, UInt64.from(withdrawAmount));

    }

}