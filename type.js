import { createPublicClient, createWalletClient, http, webSocket, encodeFunctionData, decodeFunctionResult, decodeEventLog } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const PLATFORM_ADDRESS = '0x5E5205CF39E766118C01636bED000A54D93163E6';
const RPC_URL = 'https://dream-rpc.somnia.network/';
const WS_URL = 'wss://dream-rpc.somnia.network/ws';
const PER_AGENT_EXECUTION_COST = 100000000000000000n;
const SUBCOMMITTEE_SIZE = 3n; // matches the platform default

// ResponseStatus enum values (matches Solidity contract)
const ResponseStatus = {
  None: 0,      // Default zero value (uninitialized storage)
  Pending: 1,   // Awaiting responses
  Success: 2,   // Consensus reached normally
  Failed: 3,    // Validators reported failure
  TimedOut: 4   // Request timed out
} as const;

// Platform ABI (subset of IAgentRequester)
const platformAbi = [
  {
    type: 'function',
    name: 'createRequest',
    inputs: [
      { type: 'uint256', name: 'agentId' },
      { type: 'address', name: 'callbackAddress' },
      { type: 'bytes4', name: 'callbackSelector' },
      { type: 'bytes', name: 'payload' }
    ],
    outputs: [{ type: 'uint256', name: 'requestId' }],
    stateMutability: 'payable'
  },
  {
    type: 'function',
    name: 'getRequestDeposit',
    inputs: [],
    outputs: [{ type: 'uint256', name: '' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getRequest',
    inputs: [{ type: 'uint256', name: 'requestId' }],
    outputs: [{
      type: 'tuple',
      components: [
        { type: 'uint256', name: 'id' },
        { type: 'address', name: 'requester' },
        { type: 'address', name: 'callbackAddress' },
        { type: 'bytes4', name: 'callbackSelector' },
        { type: 'address[]', name: 'subcommittee' },
        { type: 'tuple[]', name: 'responses', components: [
          { type: 'address', name: 'validator' },
          { type: 'bytes', name: 'result' },
          { type: 'uint8', name: 'status' },
          { type: 'uint256', name: 'receipt' },
          { type: 'uint256', name: 'timestamp' },
          { type: 'uint256', name: 'executionCost' }
        ]},
        { type: 'uint256', name: 'responseCount' },
        { type: 'uint256', name: 'failureCount' },
        { type: 'uint256', name: 'threshold' },
        { type: 'uint256', name: 'createdAt' },
        { type: 'uint256', name: 'deadline' },
        { type: 'uint8', name: 'status' },
        { type: 'uint8', name: 'consensusType' },
        { type: 'uint256', name: 'remainingBudget' },
        { type: 'uint256', name: 'perAgentBudget' }
      ]
    }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    name: 'RequestCreated',
    inputs: [
      { type: 'uint256', name: 'requestId', indexed: true },
      { type: 'uint256', name: 'agentId', indexed: true },
      { type: 'uint256', name: 'perAgentBudget', indexed: false },
      { type: 'bytes', name: 'payload', indexed: false },
      { type: 'address[]', name: 'subcommittee', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'RequestFinalized',
    inputs: [
      { type: 'uint256', name: 'requestId', indexed: true },
      { type: 'uint8', name: 'status', indexed: false }
    ]
  }
] as const;

// Agent method ABI (for encoding the payload and decoding the response)
const agentMethodAbi = [{
  "type": "function",
  "name": "ExtractString",
  "inputs": [
    {
      "type": "string",
      "name": "key"
    },
    {
      "type": "string",
      "name": "description"
    },
    {
      "type": "string[]",
      "name": "options"
    },
    {
      "type": "string",
      "name": "prompt"
    },
    {
      "type": "string",
      "name": "url"
    },
    {
      "type": "bool",
      "name": "resolveUrl"
    },
    {
      "type": "uint8",
      "name": "numPages"
    },
    {
      "type": "uint8",
      "name": "confidenceThreshold"
    }
  ],
  "outputs": [
    {
      "type": "string",
      "name": "output"
    }
  ]
}] as const;

async function invokeAgent() {
  const account = privateKeyToAccount('0x...'); // Your private key

  const walletClient = createWalletClient({
    account,
    transport: http(RPC_URL)
  });

  const publicClient = createPublicClient({
    transport: webSocket(WS_URL)
  });

  // 1. Encode the agent function call (selector + parameters)
  const payload = encodeFunctionData({
    abi: agentMethodAbi,
    functionName: 'ExtractString',
    args: [/* key: string */, /* description: string */, /* options: string[] */, /* prompt: string */, /* url: string */, /* resolveUrl: bool */, /* numPages: uint8 */, /* confidenceThreshold: uint8 */]
  });

  // 2. Safe deposit: contract floor + per-agent execution reward.
  //    Floor only would satisfy the contract but runners would skip the
  //    request because perAgentBudget < scheduledExecutionCost.
  const reserve = await publicClient.readContract({
    address: PLATFORM_ADDRESS,
    abi: platformAbi,
    functionName: 'getRequestDeposit'
  });
  const reward = PER_AGENT_EXECUTION_COST * SUBCOMMITTEE_SIZE;
  const deposit = reserve + reward;

  // 3. Send request (no callback — we'll watch for events instead)
  const hash = await walletClient.writeContract({
    address: PLATFORM_ADDRESS,
    abi: platformAbi,
    functionName: 'createRequest',
    args: [
      12875401142070969085n, // agentId
      '0x0000000000000000000000000000000000000000', // no callback
      '0x00000000', // no callback selector
      payload
    ],
    value: deposit
  });

  console.log('Transaction submitted:', hash);

  // 4. Wait for transaction and extract requestId
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const createdLog = receipt.logs.find(log => {
    try {
      const decoded = decodeEventLog({ abi: platformAbi, data: log.data, topics: log.topics });
      return decoded.eventName === 'RequestCreated';
    } catch { return false; }
  });

  const requestId = createdLog?.args?.requestId;
  if (requestId == null) {
    throw new Error('RequestCreated event not found in transaction logs');
  }
  console.log('Request ID:', requestId);

  // 5. Watch for RequestFinalized event
  const finalizedStatus = await new Promise<number>((resolve, reject) => {
    const unwatch = publicClient.watchContractEvent({
      address: PLATFORM_ADDRESS,
      abi: platformAbi,
      eventName: 'RequestFinalized',
      onLogs: (logs) => {
        for (const log of logs) {
          if (log.args.requestId === requestId) {
            unwatch();
            resolve(Number(log.args.status));
          }
        }
      }
    });
  });

  if (finalizedStatus !== ResponseStatus.Success) {
    throw new Error(finalizedStatus === ResponseStatus.Failed ? 'Agent execution failed' : 'Request timed out');
  }

  // 6. Read the request and decode the agent response
  const request = await publicClient.readContract({
    address: PLATFORM_ADDRESS,
    abi: platformAbi,
    functionName: 'getRequest',
    args: [requestId]
  });

  if (!request.responses || request.responses.length === 0) {
    throw new Error('No responses returned for request');
  }
  const responseBytes = request.responses[0].result;
  const result = decodeFunctionResult({ abi: agentMethodAbi, functionName: 'ExtractString', data: responseBytes });
  console.log('Result:', result);
}
