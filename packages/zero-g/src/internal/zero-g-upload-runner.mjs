import {
  Indexer,
  MemData,
  StorageNode,
  Uploader,
  getFlowContract,
  selectNodes,
} from "@0gfoundation/0g-ts-sdk";
import { JsonRpcProvider, Wallet } from "ethers";

const RESULT_PREFIX = "__ZERO_G_UPLOAD_RESULT__";

const readStdin = async () => {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
};

const fail = (message) => {
  process.stdout.write(
    `${RESULT_PREFIX}${JSON.stringify({ ok: false, error: message })}\n`,
  );
  process.exit(1);
};

const main = async () => {
  const raw = process.argv[2] ?? (await readStdin());

  if (!raw) {
    fail("Missing upload payload.");
    return;
  }

  const payload = JSON.parse(raw);
  const indexer = new Indexer(payload.indexerUrl);
  const signer = new Wallet(
    payload.privateKey,
    new JsonRpcProvider(payload.blockchainRpcUrl),
  );
  const shardedNodes = await indexer.getShardedNodes();
  const [selected, ok] = selectNodes(
    shardedNodes.trusted,
    payload.expectedReplica,
    "random",
  );

  if (!ok || selected.length === 0) {
    fail("0G indexer did not return a usable random node set.");
    return;
  }

  const clients = selected.map((node) => new StorageNode(node.url));
  const firstStatus = await clients[0]?.getStatus();
  const flowAddress =
    payload.flowContractAddress ||
    firstStatus?.networkIdentity?.flowAddress;

  if (!flowAddress) {
    fail("Unable to resolve 0G flow contract address from selected nodes.");
    return;
  }

  const flow = getFlowContract(flowAddress, signer);
  const uploader = new Uploader(clients, payload.blockchainRpcUrl, flow);
  const file = new MemData(Buffer.from(payload.base64, "base64"));
  const [result, uploadError] = await uploader.splitableUpload(
    file,
    {
      expectedReplica: payload.expectedReplica,
      finalityRequired: false,
      skipIfFinalized: true,
      taskSize: 1,
    },
    {
      TooManyDataRetries: 3,
      Interval: 1,
    },
  );

  if (uploadError) {
    fail(uploadError instanceof Error ? uploadError.message : String(uploadError));
    return;
  }

  const normalized =
    result.txHashes.length === 1 && result.rootHashes.length === 1
      ? {
          locator: `0g://file/${result.rootHashes[0]}`,
          rootHash: result.rootHashes[0],
          rootHashes: result.rootHashes,
          txHash: result.txHashes[0] ?? null,
          txHashes: result.txHashes,
          txSeq: result.txSeqs[0] ?? null,
          txSeqs: result.txSeqs,
          selectedNodeUrls: clients.map((client) => client.url),
        }
      : {
          locator: `0g://file/${result.rootHashes[0] ?? ""}`,
          rootHash: result.rootHashes[0] ?? "",
          rootHashes: result.rootHashes,
          txHash: result.txHashes[0] ?? null,
          txHashes: result.txHashes,
          txSeq: result.txSeqs[0] ?? null,
          txSeqs: result.txSeqs,
          selectedNodeUrls: clients.map((client) => client.url),
        };

  process.stdout.write(
    `${RESULT_PREFIX}${JSON.stringify({ ok: true, value: normalized })}\n`,
  );
};

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
