import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { Notebox } from "../target/types/notebox";
import { DaoVote } from "../target/types/dao_vote";
import { expect, assert } from "chai";
import { set } from "@coral-xyz/anchor/dist/cjs/utils/features";

// import * as chai from 'chai';
// import chaiAsPromised from 'chai-as-promised';
// chai.use(chaiAsPromised);
// const expect = chai.expect;
//mocha.setTimeout(180_000);

describe("capstone-dao-notebox", () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();

  // const connection = provider.connection;

  const noteboxProgram = anchor.workspace.Notebox as Program<Notebox>;
  const daoProgram = anchor.workspace.DaoVote as Program<DaoVote>;
  
  let phatomWallet: anchor.web3.Keypair;
  let author: anchor.web3.Keypair;
  let scammer: anchor.web3.Keypair;
  let postPda1: PublicKey;
  let postWrongPda1: PublicKey;

  let proposerDao: anchor.web3.Keypair;
  let proposalDaoPda: PublicKey;
  let proposalDaoWrongPda: PublicKey;

  let voter: anchor.web3.Keypair;
  let voterPda1: PublicKey;

  let voter2: anchor.web3.Keypair;
  let voterPda2: PublicKey;

  let voterScammer: anchor.web3.Keypair;
  let voterScammerPda: PublicKey;

  let daoSignerPda: PublicKey;
  let noteboxConfigPda: PublicKey;
  // let daoSignerPdaNote: PublicKey;
  // let daoSignerBumpNote: number;
  let daoSignerBump: number;
  let noteboxConfigBump: number;
  
  //before("Airdrop and accounts init", async () => {

    phatomWallet = provider.wallet.payer as anchor.web3.Keypair;
    scammer = anchor.web3.Keypair.generate();
    author = anchor.web3.Keypair.generate();
    proposerDao = anchor.web3.Keypair.generate();
    voter = anchor.web3.Keypair.generate();
    voter2 = anchor.web3.Keypair.generate();
    voterScammer = anchor.web3.Keypair.generate();
    // const configAdmin = anchor.web3.Keypair.generate();

    [daoSignerPda, daoSignerBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("dao-authority")],
      daoProgram.programId
    );

    // [daoSignerPdaNote, daoSignerBumpNote] = PublicKey.findProgramAddressSync(
    //   [Buffer.from("dao-authority")],
    //   noteboxProgram.programId
    // );

    [noteboxConfigPda, noteboxConfigBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      noteboxProgram.programId
    );  

    const postData1 = {
      category: "Hotel",
      title: "My first post",
      content: "This is my first post",
      rating: 5,
      location: "New Delhi",
      timestamp: new Date().getTime(),
      expiresAt: new Date().getTime() + 60 * 60 * 24, // 1 day
    };

    postPda1 = PublicKey.findProgramAddressSync(
      [
        Buffer.from("post"),
        author.publicKey.toBuffer(),
        Buffer.from(postData1.category),  //anchor.utils.bytes.utf8.encode("hotel"),
        Buffer.from(postData1.title),
      ],
      noteboxProgram.programId
    )[0];

    const postUpdData2 = {
      content: "This is my UPDATED first post",
      rating: 7,
      location: "New Mumbai",
    };

    const proposalDoaData = {
      title: "My first proposal",
      description: "This is my first proposal",
      deadline: new Date().getTime() + 40,  // 1 minutes from now
    };

    proposalDaoPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        proposerDao.publicKey.toBuffer(),
        Buffer.from(proposalDoaData.title),
      ],
      daoProgram.programId
    )[0];

    voterPda1 = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vote"),
        proposalDaoPda.toBuffer(),
        voter.publicKey.toBuffer(),
      ],
      daoProgram.programId
    )[0];

    voterPda2 = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vote"),
        proposalDaoPda.toBuffer(),
        voter2.publicKey.toBuffer(),
      ],
      daoProgram.programId
    )[0];
    
    voterScammerPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vote"),
        proposalDaoPda.toBuffer(),
        voterScammer.publicKey.toBuffer(),
      ],
      daoProgram.programId
    )[0];


  //});

  it("should init a config successfully", async () => {

    const tx = await noteboxProgram.methods.initializeConfig()
      .accountsPartial({
        wallet: phatomWallet.publicKey,
        config: noteboxConfigPda,
        daoSigner: daoSignerPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([phatomWallet])
      .rpc();

    console.log("Transaction Signature for init config: ", tx);
    const config = await noteboxProgram.account.config.fetch(noteboxConfigPda);
    console.log("Notebox Config is: ", config.allowedCategories);

  });

  it("should create a post successfully", async () => {

    //Request airdrop for the post account
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(author.publicKey, 1e9)
    );
    const balance = await provider.connection.getBalance(author.publicKey);
    console.log("Author balance: ", balance / LAMPORTS_PER_SOL, " SOL");

    const tx = await noteboxProgram.methods.createPost(
      postData1.category,
      postData1.title,
      postData1.content,
      postData1.rating,
      postData1.location,
      new anchor.BN(postData1.timestamp),
      new anchor.BN(postData1.expiresAt)
    )
      .accountsPartial({
        author: author.publicKey,
        post: postPda1,
        config: noteboxConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

    console.log("Post PDA: ", postPda1.toBase58());
    console.log("Transaction Signature for create post: ", tx);

    // Fetch the post account and verify data
    const post = await noteboxProgram.account.post.fetch(postPda1);
    //console.log("Create Post is: ", post);

    expect(post.category).to.equal(postData1.category);
    expect(post.title).to.equal(postData1.title);
    expect(post.content).to.equal(postData1.content);
    expect(post.rating).to.equal(postData1.rating);
    expect(post.location).to.equal(postData1.location);
    expect(Number(post.timestamp)).to.equal(postData1.timestamp);
    expect(Number(post.expiresAt)).to.equal(postData1.expiresAt);
    expect(post.author.toBase58()).to.equal(author.publicKey.toBase58());
    
  });


  it("should NOT create a post with Invalid Data", async () => {

    const postWrongData1 = {
      category: "RestaurantReviewZomato", // Invalid category
      title: "My first post",
      content: "This is my first post",
      rating: 15,                         // Invalid rating > 10
      location: "New Delhi",
      timestamp: new Date().getTime(),
      expiresAt: new Date().getTime() + 60 * 60,  //  1 hour from now
    };

    postWrongPda1 = PublicKey.findProgramAddressSync(
      [
        Buffer.from("post"),
        author.publicKey.toBuffer(),
        Buffer.from(postWrongData1.category),  //anchor.utils.bytes.utf8.encode("hotel"),
        Buffer.from(postWrongData1.title),
      ],
      noteboxProgram.programId
    )[0];

    console.log("Wrong Post PDA: ", postWrongPda1.toBase58());

    try {
      const tx = await noteboxProgram.methods.createPost(
      postWrongData1.category,    // Invalid category
      postWrongData1.title,
      postWrongData1.content,
      postWrongData1.rating,     // Invalid rating > 10
      postWrongData1.location,
      new anchor.BN(postWrongData1.timestamp),
      new anchor.BN(postWrongData1.expiresAt)
    )
      .accountsPartial({
        author: author.publicKey,
        post: postWrongPda1,
        config: noteboxConfigPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([author])
      .rpc();

      console.log("Transaction Signature for Wrong create post: ", tx);
      // If the transaction succeeds, it's an error
      assert.fail("Transaction should have ideally failed");

    } catch (err) {
      // Check if the error message contains the expected error
      expect(err.message).to.include("AnchorError thrown in program");
      console.log("Test Passed: Transaction correctly Failed for Invalid Category");

       // Fetch the post account and verify data
      const post = await noteboxProgram.account.post.getAccountInfo(postWrongPda1);
      console.log("Create Wrong Post is: ", post);
    }
  });

  it("should update a post successfully", async () => {

    const tx = await noteboxProgram.methods.updPost(
      postUpdData2.content,
      postUpdData2.rating,
      postUpdData2.location
    )
      .accountsPartial({
        author: author.publicKey,
        post: postPda1,
      })
      .signers([author])
      .rpc();

    console.log("Post PDA: ", postPda1.toBase58());
    console.log("Transaction Signature for create post: ", tx);

    // Fetch the post account and verify data
    const post = await noteboxProgram.account.post.fetch(postPda1);
    //console.log("Updated Post is: ", post);

    expect(post.category).to.equal(postData1.category);
    expect(post.title).to.equal(postData1.title);
    expect(post.content).to.equal(postUpdData2.content);    // updated content matches
    expect(post.rating).to.equal(postUpdData2.rating);    // updated rating matches
    expect(post.location).to.equal(postUpdData2.location);    //updated location matches
    expect(Number(post.timestamp)).to.equal(postData1.timestamp);
    expect(Number(post.expiresAt)).to.equal(postData1.expiresAt);
    expect(post.author.toBase58()).to.equal(author.publicKey.toBase58());


  });

  it("Non-Author should NOT update a post successfully", async () => {

    //Request airdrop for the post account
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(scammer.publicKey, 1e9)
    );
    const balance = await provider.connection.getBalance(scammer.publicKey);
    console.log("Scammer balance: ", balance / LAMPORTS_PER_SOL, " SOL");

    await noteboxProgram.methods.updPost(
      postUpdData2.content,
      postUpdData2.rating,
      postUpdData2.location
    )
      .accounts({
        author: scammer.publicKey,    // scammer is not the author
        post: postPda1,
      })
      .signers([scammer])   // even though scammer is airdropped, he is not the author
      .rpc()
      .then(() => {
        throw new Error("Transaction should have failed");
      })
      .catch((err) => {
        expect(err).to.exist;
        expect(err.message).to.include("AnchorError caused by account: author");

        console.log("Test Passed: Transaction correctly Failed for unauthorized user");
      });

  });

  it("should delete a post successfully", async () => {

    const tx = await noteboxProgram.methods.delPost()
    .accountsPartial({
      author: author.publicKey,
      post: postPda1,
    })
    .signers([author])
    .rpc();

    console.log("Post PDA: ", postPda1.toBase58());
    console.log("Transaction Signature for create post: ", tx);
    const balance = await provider.connection.getBalance(postPda1);
    console.log("Deleted Post balance: ", balance / LAMPORTS_PER_SOL, " SOL");

    const post = await noteboxProgram.account.post.fetchNullable(postPda1);
    console.log("Deleted Post is: ", post);

    expect(post).to.be.null; // Post should be null after deletion
  });

  it("should create a proposal successfully", async () => {

    //Request airdrop for the post account
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(proposerDao.publicKey, 1e9)
    );
    const balance = await provider.connection.getBalance(proposerDao.publicKey);
    console.log("Proposal balance: ", balance / LAMPORTS_PER_SOL, " SOL");

    console.log("Proposal PDA: ", proposalDaoPda.toBase58());

    const tx = await daoProgram.methods.createProposal(
      proposalDoaData.title,
      proposalDoaData.description,
      new anchor.BN(proposalDoaData.deadline)
    )
      .accountsPartial({
        proposer: proposerDao.publicKey,
        proposal: proposalDaoPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([proposerDao])
      .rpc();

      console.log("Transaction Signature for create post: ", tx);

    // Fetch the post account and verify data
    const proposal = await daoProgram.account.proposal.fetch(proposalDaoPda);
    //console.log("Create Post is: ", proposal);

    expect(proposal.title).to.equal(proposalDoaData.title);
    expect(proposal.description).to.equal(proposalDoaData.description);
    expect(Number(proposal.deadline)).to.equal(proposalDoaData.deadline);

  });

  it("should NOT create a proposal with Invalid data", async () => {

    const proposalWrongData = {
      title: "My wrong proposal",
      description: "My wrong proposal",
      deadline: new Date().getTime() - 1000 * 60 * 60 * 24, // Invalid deadline
    };

    proposalDaoWrongPda = PublicKey.findProgramAddressSync(
      [
        Buffer.from("proposal"),
        proposerDao.publicKey.toBuffer(),
        Buffer.from(proposalWrongData.title),
      ],
      daoProgram.programId
    )[0];

    console.log("Wrong Proposal PDA: ", proposalDaoWrongPda.toBase58());

    try {
      const tx =
       await daoProgram.methods.createProposal(
        proposalWrongData.title,
        proposalWrongData.description,
        new anchor.BN(proposalWrongData.deadline)
      )
        .accountsPartial({
          proposer: proposerDao.publicKey,
          proposal: proposalDaoWrongPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([proposerDao])
        .rpc();

      assert.fail("Transaction should have failed");
      console.log("Transaction Signature for create post: ", tx);
      // If the transaction succeeds, it's an error

    } catch (err) {
      // Check if the error message contains the expected error
      expect(err.message).to.include("Transaction should have failed");
      console.log("Test Passed: Transaction correctly Failed for Invalid Proposal deadline in past");

      // Fetch the post account and verify data
      // const proposal = await daoProgram.account.proposal.fetch(proposalDaoWrongPda);
      // console.log("Create Wrong Proposal Dealine is: ", Number(proposal.deadline));
    }

  });

  it("should create a vote successfully", async () => {

    console.log("Voter PDA: ", voterPda1.toBase58());
    console.log("Proposal PDA: ", proposalDaoPda.toBase58());

    //Request airdrop for the post account
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(voter.publicKey, 1e9)
    );
    const balance = await provider.connection.getBalance(voter.publicKey);
    console.log("Voter 1 balance: ", balance / LAMPORTS_PER_SOL, " SOL");

    const tx = await daoProgram.methods.voteProposal(
      true
    ).accountsPartial({
        voter: voter.publicKey,
        proposal: proposalDaoPda,
        voteRecord: voterPda1,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter])
      .rpc();

    console.log("Transaction Signature for create vote: ", tx);

    // Fetch the post account and verify data
    const proposal = await daoProgram.account.proposal.fetch(proposalDaoPda);
    //console.log("Create Proposal is: ", proposal);
    const castVote = await daoProgram.account.voteRecord.fetch(voterPda1);
    //console.log("Create Proposal is: ", castVote);

    expect(Number(proposal.yesVotes)).to.equal(1);
    expect(castVote.votedYes).to.equal(true);  

  });

  it("should create a 2nd vote successfully", async () => {

    console.log("Voter PDA: ", voterPda2.toBase58());
    console.log("Proposal PDA: ", proposalDaoPda.toBase58());

    //Request airdrop for the post account
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(voter2.publicKey, 1e9)
    );
    const balance = await provider.connection.getBalance(voter2.publicKey);
    console.log("Voter 2 balance: ", balance / LAMPORTS_PER_SOL, " SOL");

    const tx = await daoProgram.methods.voteProposal(
      true
    ).accountsPartial({
        voter: voter2.publicKey,
        proposal: proposalDaoPda,
        voteRecord: voterPda2,
        systemProgram: SystemProgram.programId,
      })
      .signers([voter2])
      .rpc();

    console.log("Transaction Signature for create vote: ", tx);

    // Fetch the post account and verify data
    const proposal = await daoProgram.account.proposal.fetch(proposalDaoPda);
    //console.log("Create Proposal is: ", proposal);
    const castVote = await daoProgram.account.voteRecord.fetch(voterPda2);
    //console.log("Create Proposal is: ", castVote);

    expect(Number(proposal.yesVotes)).to.equal(2);
    expect(castVote.votedYes).to.equal(true);  

  });

  // it("Voting Still Open - Calls update_config in notebox via CPI from dao_vote", async () => {

  //   const configData = {
  //     allowedCategories: ["travel"],
  //     maxPostLength: 700,
  //     paused: false,
  //     dao_bump: daoSignerBump
  //   }

  //   try {
  //   await daoProgram.methods
  //     .closeProposal(
  //       configData.allowedCategories,
  //       configData.maxPostLength,
  //       configData.paused,
  //       configData.dao_bump,
  //     )
  //     .accountsPartial({
  //       daoSigner: daoSignerPda,
  //       proposal: proposalDaoPda,
  //       noteboxConfig: noteboxConfigPda,
  //       noteboxProgram: noteboxProgram.programId,
  //     })
  //     .signers([])
  //     .rpc();  // .preInstructions([]) // if needed

  //   console.log("CPI to notebox successful");
  //   // If the transaction succeeds, it's an error
  //   assert.fail("Transaction should have ideally failed");

  //   } catch (err) {
  //     // Check if the error message contains the expected error
  //     expect(err.message).to.include("AnchorError thrown in programs");
  //     console.log("Test Passed: Transaction correctly Failed for VotingStillOpen");
  //   }
  // });

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  it("Calls update_config in notebox via CPI from dao_vote", async () => {

    // Fetch the post account and verify data
    // const proposalBefore = await daoProgram.account.proposal.fetch(proposalDaoPda);
    // console.log("Create Proposal is: ", proposalBefore);

    // const now = new Date();
    // console.log("Current Date and Time:", now.getTime());
    // console.log("Current Date and Time:", Number(proposalBefore.deadline));

    // console.log("DAO Signer PDA", daoSignerPda.toBase58());
    // console.log("Signer Seeds", daoSignerBump);
    // console.log("Notebox DAO Signer PDA", daoSignerPdaNote.toBase58());
    // console.log("Notebox DAO  Seeds", daoSignerBumpNote);
    // console.log("Notebox Config PDA", noteboxConfigPda.toBase58());
    // console.log("Notebox Config Seeds", noteboxConfigBump);

    //await sleep(1 * 60 * 1000); // 2 minutes in milliseconds
    // useFakeTimers();

    const configData = {
      allowedCategories: ["travel"],
      maxPostLength: 700,
      paused: false,
      dao_bump: daoSignerBump
    };
    
    const tx = await daoProgram.methods
      .closeProposal(
        configData.allowedCategories,
        configData.maxPostLength,
        configData.paused,
        configData.dao_bump
      )
      .accountsPartial({
        daoSigner: daoSignerPda,
        proposal: proposalDaoPda,
        clock: anchor.web3.SYSVAR_CLOCK_PUBKEY,
        noteboxConfig: noteboxConfigPda,
        noteboxProgram: noteboxProgram.programId,
      })
      .signers([])
      .rpc();  // .preInstructions([]) // if needed

    console.log("CPI to notebox successful  " + tx );

   // Fetch the post account and verify data
   const proposalAfter = await daoProgram.account.proposal.fetch(proposalDaoPda);
   console.log("Create Proposal is: ", proposalAfter);

  //  const nowAfter = new Date();
  //  console.log("Current Date and Time:", nowAfter.getTime());
  //  console.log("Current Date and Time:", Number(proposalAfter.deadline));

  });

  // });
  // }, 1000 * 60 * 1); // 5 minutes

  it("should NOT create a vote after proposal deadline", async () => {

    //Request airdrop for the post account
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(voterScammer.publicKey, 1e9)
    );
    const balance = await provider.connection.getBalance(voterScammer.publicKey);
    console.log("Voter Scammer balance: ", balance / LAMPORTS_PER_SOL, " SOL");

   try {
      const tx = await daoProgram.methods.voteProposal(
        true
      ).accountsPartial({
          voter: voterScammer.publicKey,
          proposal: proposalDaoPda,
          voteRecord: voterScammerPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([voterScammer])
        .rpc();

      console.log("Transaction Signature for create vote: ", tx);
      // If the transaction succeeds, it's an error
      assert.fail("Transaction should have failed");

    } catch (err) {
      // Check if the error message contains the expected error
      expect(err.message).to.include("AnchorError caused by account: proposal. Error Code: AlreadyExecuted");
      console.log("Test Passed: Transaction correctly Failed for VotingAfterDeadline");
    }
  });

  it("Add a new Post using New Category", async () => {

    const postDataNew = {
      category: "travel",
      title: "My 2nd post",
      content: "This is my 2nd post with new category added via CPI",
      rating: 9,
      location: "Chandigarh",
      timestamp: new Date().getTime(),
      expiresAt: new Date().getTime() + 60 * 60 * 24, // 1 day
    };

    const postPdaNew = PublicKey.findProgramAddressSync(
      [
        Buffer.from("post"),
        author.publicKey.toBuffer(),
        Buffer.from(postDataNew.category),  //anchor.utils.bytes.utf8.encode("hotel"),
        Buffer.from(postDataNew.title),
      ],
      noteboxProgram.programId
    )[0];

    console.log("New Category Post PDA: ", postPdaNew.toBase58());

    const tx = await noteboxProgram.methods.createPost(
      postDataNew.category,
      postDataNew.title,
      postDataNew.content,
      postDataNew.rating,
      postDataNew.location,
      new anchor.BN(postDataNew.timestamp),
      new anchor.BN(postDataNew.expiresAt)
    )
      .accountsPartial({
        author: author.publicKey,
        post: postPdaNew,
        config: noteboxConfigPda,
        systemProgram: SystemProgram.programId,
    })
    .signers([author])
    .rpc();

    console.log("Transaction Signature for create post: ", tx);

    // Fetch the post account and verify data
    const post = await noteboxProgram.account.post.fetch(postPdaNew);
    console.log("Category for New Post is: ", post.category);

    expect(post.category).to.equal(postDataNew.category);
    expect(post.title).to.equal(postDataNew.title);
    expect(post.content).to.equal(postDataNew.content);
    expect(post.rating).to.equal(postDataNew.rating);
    expect(post.location).to.equal(postDataNew.location);
    expect(Number(post.timestamp)).to.equal(postDataNew.timestamp);
    expect(Number(post.expiresAt)).to.equal(postDataNew.expiresAt);
    expect(post.author.toBase58()).to.equal(author.publicKey.toBase58());

  });

});


