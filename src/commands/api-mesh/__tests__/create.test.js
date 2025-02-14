/*
Copyright 2021 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

const mockConsoleCLIInstance = {};
const crypto = require('crypto');

jest.mock('axios');
jest.mock('@adobe/aio-lib-ims');
jest.mock('@adobe/aio-lib-env');
jest.mock('@adobe/aio-cli-lib-console', () => ({
	init: jest.fn().mockResolvedValue(mockConsoleCLIInstance),
	cleanStdOut: jest.fn(),
}));
jest.mock('../../../helpers', () => ({
	initSdk: jest.fn().mockResolvedValue({}),
	initRequestId: jest.fn().mockResolvedValue({}),
	promptConfirm: jest.fn().mockResolvedValue(true),
	interpolateMesh: jest.fn().mockResolvedValue({}),
	importFiles: jest.fn().mockResolvedValue(),
}));
jest.mock('../../../lib/devConsole');

const CreateCommand = require('../create');
const sampleCreateMeshConfig = require('../../__fixtures__/sample_mesh.json');
const meshConfigWithComposerFiles = require('../../__fixtures__/sample_mesh_with_composer_files.json');
const {
	initSdk,
	initRequestId,
	promptConfirm,
	interpolateMesh,
	importFiles,
} = require('../../../helpers');
const {
	getMesh,
	createMesh,
	getTenantFeatures,
	getPublicEncryptionKey,
} = require('../../../lib/devConsole');

const selectedOrg = { id: '1234', code: 'CODE1234@AdobeOrg', name: 'ORG01', type: 'entp' };

const os = require('os');

const selectedProject = { id: '5678', title: 'Project01' };
const selectedWorkspace = { id: '123456789', title: 'Workspace01' };

jest.mock('@adobe/aio-cli-lib-console', () => ({
	init: jest.fn().mockResolvedValue(mockConsoleCLIInstance),
	cleanStdOut: jest.fn(),
}));

jest.mock('axios');
jest.mock('@adobe/aio-lib-ims');
jest.mock('@adobe/aio-lib-env');
jest.mock('@adobe/aio-cli-lib-console');
jest.mock('../../../helpers', () => ({
	initSdk: jest.fn().mockResolvedValue({}),
	initRequestId: jest.fn().mockResolvedValue({}),
	promptConfirm: jest.fn().mockResolvedValue(true),
	interpolateMesh: jest.fn().mockResolvedValue({}),
	importFiles: jest.fn().mockResolvedValue(),
}));
jest.mock('../../../lib/devConsole');
jest.mock('chalk', () => ({
	red: jest.fn(text => text), // Return the input text without any color formatting
	bold: jest.fn(text => text),
	underline: {
		blue: jest.fn(text => text),
	},
	bgYellow: jest.fn(text => text),
}));
jest.mock('crypto');

let logSpy = null;
let errorLogSpy = null;
let parseSpy = null;
let platformSpy = null;

const mockIgnoreCacheFlag = Promise.resolve(true);
const mockAutoApproveAction = Promise.resolve(false);

// Mock randomBytes for aesKey and iv
const mockAesKey = Buffer.from('mockAesKey');
const mockIv = Buffer.from('mockIv');
const mockEncryptedAesKey = Buffer.from('mockEncryptedAesKey');
const mockCipher = {
	update: jest.fn().mockReturnValueOnce('mockEncryptedData'),
	final: jest.fn().mockReturnValueOnce(''),
};

describe('create command tests', () => {
	beforeEach(() => {
		initSdk.mockResolvedValue({
			imsOrgId: selectedOrg.id,
			imsOrgCode: selectedOrg.code,
			projectId: selectedProject.id,
			workspaceId: selectedWorkspace.id,
			workspaceName: selectedWorkspace.title,
			orgName: selectedOrg.name,
			projectName: selectedProject.title,
		});

		global.requestId = 'dummy_request_id';

		logSpy = jest.spyOn(CreateCommand.prototype, 'log');
		errorLogSpy = jest.spyOn(CreateCommand.prototype, 'error');
		platformSpy = jest.spyOn(os, 'platform');

		createMesh.mockResolvedValue({
			mesh: {
				meshId: 'dummy_mesh_id',
				meshConfig: sampleCreateMeshConfig.meshConfig,
			},
		});

		getMesh.mockResolvedValue({
			meshId: 'dummy_id',
			meshURL: '',
		});

		getTenantFeatures.mockResolvedValue({
			imsOrgId: selectedProject.code,
			showCloudflareURL: false,
		});

		getPublicEncryptionKey.mockResolvedValue('dummy_public_key');
		global.requestId = 'dummy_request_id';

		logSpy = jest.spyOn(CreateCommand.prototype, 'log');
		errorLogSpy = jest.spyOn(CreateCommand.prototype, 'error');
		parseSpy = jest.spyOn(CreateCommand.prototype, 'parse');
		parseSpy.mockResolvedValue({
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
			},
		});
	});

	afterEach(() => {
		platformSpy.mockRestore();
	});

	test('must return proper object structure used by adobe/generator-app-api-mesh', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: {
				json: Promise.resolve(true),
			},
		});
		const output = await CreateCommand.run();
		expect(output).toMatchInlineSnapshot(`
		{
		  "imsOrgId": "1234",
		  "meshConfig": {
		    "sources": [
		      {
		        "handler": {
		          "graphql": {
		            "endpoint": "<gql_endpoint>",
		          },
		        },
		        "name": "<api_name>",
		      },
		    ],
		  },
		  "meshId": "dummy_mesh_id",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
	});

	test('snapshot create command description', () => {
		expect(CreateCommand.description).toMatchInlineSnapshot(
			`"Create a mesh with the given config."`,
		);
		expect(CreateCommand.args).toMatchInlineSnapshot(`
		[
		  {
		    "name": "file",
		  },
		]
	`);

		expect(CreateCommand.flags).toMatchInlineSnapshot(`
		{
		  "autoConfirmAction": {
		    "allowNo": false,
		    "char": "c",
		    "default": false,
		    "description": "Auto confirm action prompt. CLI will not check for user approval before executing the action.",
		    "parse": [Function],
		    "type": "boolean",
		  },
		  "env": {
		    "char": "e",
		    "default": ".env",
		    "description": "Path to env file",
		    "input": [],
		    "multiple": false,
		    "parse": [Function],
		    "type": "option",
		  },
		  "ignoreCache": {
		    "allowNo": false,
		    "char": "i",
		    "default": false,
		    "description": "Ignore cache and force manual org -> project -> workspace selection",
		    "parse": [Function],
		    "type": "boolean",
		  },
		  "json": {
		    "allowNo": false,
		    "default": false,
		    "description": "Output JSON",
		    "parse": [Function],
		    "type": "boolean",
		  },
		  "secrets": {
		    "char": "s",
		    "default": false,
		    "description": "Path to secrets file",
		    "input": [],
		    "multiple": false,
		    "parse": [Function],
		    "type": "option",
		  },
		}
	`);
		expect(CreateCommand.aliases).toMatchInlineSnapshot(`[]`);
	});

	test('should pass if a valid mesh config file with composer files are provided', async () => {
		createMesh.mockResolvedValueOnce({
			mesh: {
				meshId: 'dummy_mesh_id',
				meshConfig: meshConfigWithComposerFiles.meshConfig,
			},
		});

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_composer_files.json' },
			flags: {
				autoConfirmAction: Promise.resolve(true),
			},
		});

		const output = await CreateCommand.run();

		expect(output).toMatchInlineSnapshot(`
		{
		  "imsOrgId": "1234",
		  "meshConfig": {
		    "files": [
		      {
		        "content": "{"type":"dummyContent"}",
		        "path": "./requestParams.json",
		      },
		      {
		        "content": "module.exports.functionName = () => { console.log('beforeAll hook'); }",
		        "path": "./hooks.js",
		      },
		    ],
		    "plugins": [
		      {
		        "hooks": {
		          "beforeAll": {
		            "composer": "./hooks.js#functionName",
		          },
		        },
		      },
		    ],
		    "sources": [
		      {
		        "handler": {
		          "JsonSchema": {
		            "baseUrl": "<json_source__baseurl>",
		            "operations": [
		              {
		                "field": "<query>",
		                "method": "POST",
		                "path": "<query_path>",
		                "requestSchema": "./requestParams.json",
		                "type": "Query",
		              },
		            ],
		          },
		        },
		        "name": "<json_source_name>",
		      },
		    ],
		  },
		  "meshId": "dummy_mesh_id",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
	});

	test('should fail if create mesh api has failed', async () => {
		createMesh.mockRejectedValueOnce(new Error('create mesh api failed'));

		const runResult = CreateCommand.run();
		await expect(runResult).rejects.toEqual(
			new Error(
				'Unable to create a mesh. Check the mesh configuration file and try again. If the error persists please contact support. RequestId: dummy_request_id',
			),
		);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "create mesh api failed",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to create a mesh. Check the mesh configuration file and try again. If the error persists please contact support. RequestId: dummy_request_id",
		  ],
		]
	`);
	});

	test('should create if a valid mesh config file is provided', async () => {
		const runResult = await CreateCommand.run();

		expect(initRequestId).toHaveBeenCalled();
		expect(createMesh.mock.calls[0]).toMatchInlineSnapshot(`
		[
		  "CODE1234@AdobeOrg",
		  "5678",
		  "123456789",
		  "Workspace01",
		  "ORG01",
		  "Project01",
		  {
		    "meshConfig": {
		      "sources": [
		        {
		          "handler": {
		            "graphql": {
		              "endpoint": "<gql_endpoint>",
		            },
		          },
		          "name": "<api_name>",
		        },
		      ],
		    },
		  },
		]
	`);
		expect(runResult).toMatchInlineSnapshot(`
		{
		  "imsOrgId": "1234",
		  "meshConfig": {
		    "sources": [
		      {
		        "handler": {
		          "graphql": {
		            "endpoint": "<gql_endpoint>",
		          },
		        },
		        "name": "<api_name>",
		      },
		    ],
		  },
		  "meshId": "dummy_mesh_id",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "******************************************************************************************************",
		  ],
		  [
		    "Your mesh is being provisioned. Wait a few minutes before checking the status of your mesh %s",
		    "dummy_mesh_id",
		  ],
		  [
		    "To check the status of your mesh, run:",
		  ],
		  [
		    "aio api-mesh:status",
		  ],
		  [
		    "******************************************************************************************************",
		  ],
		  [
		    "Mesh Endpoint: %s",
		    "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`[]`);
	});

	test('should create and return Ti mesh url if a valid mesh config file for TI client is provided', async () => {
		let fetchedMeshConfig = sampleCreateMeshConfig;
		fetchedMeshConfig.meshId = 'dummy_id';
		fetchedMeshConfig.meshURL = 'https://tigraph.adobe.io';
		getMesh.mockResolvedValueOnce(fetchedMeshConfig);

		const runResult = await CreateCommand.run();

		expect(initRequestId).toHaveBeenCalled();
		expect(createMesh.mock.calls[0]).toMatchInlineSnapshot(`
		[
		  "CODE1234@AdobeOrg",
		  "5678",
		  "123456789",
		  "Workspace01",
		  "ORG01",
		  "Project01",
		  {
		    "meshConfig": {
		      "sources": [
		        {
		          "handler": {
		            "graphql": {
		              "endpoint": "<gql_endpoint>",
		            },
		          },
		          "name": "<api_name>",
		        },
		      ],
		    },
		  },
		]
	`);

		expect(runResult).toMatchInlineSnapshot(`
		{
		  "imsOrgId": "1234",
		  "meshConfig": {
		    "sources": [
		      {
		        "handler": {
		          "graphql": {
		            "endpoint": "<gql_endpoint>",
		          },
		        },
		        "name": "<api_name>",
		      },
		    ],
		  },
		  "meshId": "dummy_mesh_id",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "******************************************************************************************************",
		  ],
		  [
		    "Your mesh is being provisioned. Wait a few minutes before checking the status of your mesh %s",
		    "dummy_mesh_id",
		  ],
		  [
		    "To check the status of your mesh, run:",
		  ],
		  [
		    "aio api-mesh:status",
		  ],
		  [
		    "******************************************************************************************************",
		  ],
		  [
		    "Mesh Endpoint: %s",
		    "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`[]`);
	});

	test('should fail if mesh config file arg is missing', async () => {
		parseSpy.mockResolvedValueOnce({
			args: {},
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
			},
		});
		const runResult = CreateCommand.run();

		await expect(runResult).rejects.toEqual(
			new Error('Missing file path. Run aio api-mesh create --help for more info.'),
		);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`[]`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Missing file path. Run aio api-mesh create --help for more info.",
		  ],
		]
	`);
	});

	test('should fail if mesh file is invalid', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'dummy_file_path' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
			},
		});
		const runResult = CreateCommand.run();
		const expected = [expect.stringMatching(/ENOENT: no such file or directory/)];

		await expect(runResult).rejects.toEqual(
			new Error(
				'Unable to read the mesh configuration file provided. Please check the file and try again.',
			),
		);
		expect(logSpy.mock.calls[0]).toEqual(expect.arrayContaining(expected));
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to read the mesh configuration file provided. Please check the file and try again.",
		  ],
		]
	`);
	});

	test('should not ask for confirmation if autoConfirmAction is provided', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: Promise.resolve(true),
			},
		});

		await CreateCommand.run();

		expect(initRequestId).toHaveBeenCalled();
		expect(promptConfirm).not.toHaveBeenCalled();
		expect(initSdk).toHaveBeenCalledWith({
			ignoreCache: true,
		});
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "******************************************************************************************************",
		  ],
		  [
		    "Your mesh is being provisioned. Wait a few minutes before checking the status of your mesh %s",
		    "dummy_mesh_id",
		  ],
		  [
		    "To check the status of your mesh, run:",
		  ],
		  [
		    "aio api-mesh:status",
		  ],
		  [
		    "******************************************************************************************************",
		  ],
		  [
		    "Mesh Endpoint: %s",
		    "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`[]`);
	});

	test('should stop creation if user declines confirmation', async () => {
		promptConfirm.mockResolvedValueOnce(false);

		await CreateCommand.run();

		expect(initRequestId).toHaveBeenCalled();
		expect(promptConfirm).toHaveBeenCalled();
		expect(initSdk).toHaveBeenCalledWith({
			ignoreCache: true,
		});
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Create cancelled",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`[]`);
	});

	test('must return proper object structure used by adobe/generator-app-api-mesh', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: {
				json: Promise.resolve(true),
			},
		});
		const output = await CreateCommand.run();
		expect(output).toMatchInlineSnapshot(`
		{
		  "imsOrgId": "1234",
		  "meshConfig": {
		    "sources": [
		      {
		        "handler": {
		          "graphql": {
		            "endpoint": "<gql_endpoint>",
		          },
		        },
		        "name": "<api_name>",
		      },
		    ],
		  },
		  "meshId": "dummy_mesh_id",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
	});

	test('should return error if the mesh has placeholders and env file provided using --env flag is not found', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_placeholder' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: Promise.resolve(true),
				env: 'src/commands/__fixtures__/.env_nonExisting',
			},
		});
		const runResult = CreateCommand.run();

		await expect(runResult).rejects.toEqual(
			new Error(
				'Unable to read the file src/commands/__fixtures__/.env_nonExisting. Please check the file and try again.',
			),
		);

		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "The provided mesh contains placeholders. Starting mesh interpolation process.",
		  ],
		  [
		    "ENOENT: no such file or directory, open 'src/commands/__fixtures__/.env_nonExisting'",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to read the file src/commands/__fixtures__/.env_nonExisting. Please check the file and try again.",
		  ],
		]
	`);
	});

	test('should return error if mesh has placeholders and the provided env file is invalid and parsed to {}', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_placeholder' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: Promise.resolve(true),
				env: 'src/commands/__fixtures__/env_invalid',
			},
		});

		const runResult = CreateCommand.run();

		await expect(runResult).rejects.toEqual(
			new Error(
				'Issue in src/commands/__fixtures__/env_invalid file - Interpolated mesh is not a valid JSON. Please check the generated json file.',
			),
		);

		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Interpolated mesh is not a valid JSON. Please check the generated json file.",
		  ],
		  [
		    "Issue in src/commands/__fixtures__/env_invalid file - Interpolated mesh is not a valid JSON. Please check the generated json file.",
		  ],
		]
	`);
	});

	test('should return error if the mesh has placeholders and the provided env file is valid but there are missing keys found in mesh interpolation', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_placeholder' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: Promise.resolve(true),
				env: 'src/commands/__fixtures__/env_valid',
			},
		});

		interpolateMesh.mockResolvedValueOnce({
			interpolationStatus: 'failed',
			missingKeys: ['newKey1', 'newKey2'],
			interpolatedMesh: '',
		});

		const runResult = CreateCommand.run();
		await expect(runResult).rejects.toEqual(
			new Error(
				'Issue in src/commands/__fixtures__/env_valid file - The mesh file cannot be interpolated due to missing keys : newKey1 , newKey2',
			),
		);

		await expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "The mesh file cannot be interpolated due to missing keys : newKey1 , newKey2",
		  ],
		  [
		    "Issue in src/commands/__fixtures__/env_valid file - The mesh file cannot be interpolated due to missing keys : newKey1 , newKey2",
		  ],
		]
	`);
	});

	test('should return error if the provided env file is valid and mesh interpolation is successful but interpolated mesh is not a valid JSON', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_placeholder' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: Promise.resolve(true),
				env: 'src/commands/__fixtures__/env_valid',
			},
		});

		//sampleInterpolated mesh where value of responseConfig.includeHTTPDetails is invalid i.e. non-boolean
		const sampleInterpolatedMesh =
			'{"meshConfig":{"sources":[{"name":"<api-name>","handler":{"graphql":{"endpoint":"<api-url>"}}}],"responseConfig":{"includeHTTPDetails":sample}}}';

		interpolateMesh.mockResolvedValueOnce({
			interpolationStatus: 'success',
			missingKeys: [],
			interpolatedMeshData: sampleInterpolatedMesh,
		});

		const runResult = CreateCommand.run();
		await expect(runResult).rejects.toEqual(
			new Error(
				'Issue in src/commands/__fixtures__/env_valid file - Interpolated mesh is not a valid JSON. Please check the generated json file.',
			),
		);

		await expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Interpolated mesh is not a valid JSON. Please check the generated json file.",
		  ],
		  [
		    "Issue in src/commands/__fixtures__/env_valid file - Interpolated mesh is not a valid JSON. Please check the generated json file.",
		  ],
		]
	`);
	});

	test('should successfully create a mesh if provided env file is valid, mesh interpolation is successful and interpolated mesh is a valid JSON', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_placeholder' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
				env: 'src/commands/__fixtures__/env_valid',
			},
		});

		//sampleInterpolated mesh where the mesh string is a valid JSON
		const sampleInterpolatedMesh =
			'{"meshConfig":{"sources":[{"name":"<api-name>","handler":{"graphql":{"endpoint":"<api-url>"}}}],"responseConfig":{"includeHTTPDetails":true}}}';

		interpolateMesh.mockResolvedValueOnce({
			interpolationStatus: 'success',
			missingKeys: [],
			interpolatedMeshData: sampleInterpolatedMesh,
		});

		const runResult = await CreateCommand.run();

		expect(promptConfirm).toHaveBeenCalledWith('Are you sure you want to create a mesh?');
		expect(runResult).toMatchInlineSnapshot(`
		{
		  "imsOrgId": "1234",
		  "meshConfig": {
		    "sources": [
		      {
		        "handler": {
		          "graphql": {
		            "endpoint": "<gql_endpoint>",
		          },
		        },
		        "name": "<api_name>",
		      },
		    ],
		  },
		  "meshId": "dummy_mesh_id",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
	});

	test('should return error if inputMesh is not a valid JSON', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_invalid_mesh.txt' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
			},
		});

		const runResult = CreateCommand.run();
		await expect(runResult).rejects.toEqual(
			new Error('Input mesh file is not a valid JSON. Check the file provided.'),
		);

		await expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Input mesh file is not a valid JSON. Check the file provided.",
		  ],
		]
	`);
	});

	test('should pass if there are local files in meshConfig i.e., the file is appended in files array', async () => {
		let meshConfig = {
			sources: [
				{
					name: '<json_source_name>',
					handler: {
						JsonSchema: {
							baseUrl: '<json_source__baseurl>',
							operations: [
								{
									type: 'Query',
									field: '<query>',
									path: '<query_path>',
									method: 'POST',
									requestSchema: './requestParams.json',
								},
							],
						},
					},
				},
			],
			files: [
				{
					path: './requestParams.json',
					content: '{"type":"updatedContent"}',
				},
			],
		};

		createMesh.mockResolvedValueOnce({
			mesh: {
				meshId: 'dummy_mesh_id',
				meshConfig: meshConfig,
			},
		});

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_files.json' },
			flags: {
				autoConfirmAction: Promise.resolve(false),
			},
		});

		importFiles.mockResolvedValueOnce({
			meshConfig,
		});

		const output = await CreateCommand.run();

		expect(initRequestId).toHaveBeenCalled();
		expect(createMesh.mock.calls[0]).toMatchInlineSnapshot(`
		[
		  "CODE1234@AdobeOrg",
		  "5678",
		  "123456789",
		  "Workspace01",
		  "ORG01",
		  "Project01",
		  {
		    "meshConfig": {
		      "files": [
		        {
		          "content": "{"type":"updatedContent"}",
		          "path": "./requestParams.json",
		        },
		      ],
		      "sources": [
		        {
		          "handler": {
		            "JsonSchema": {
		              "baseUrl": "<json_source__baseurl>",
		              "operations": [
		                {
		                  "field": "<query>",
		                  "method": "POST",
		                  "path": "<query_path>",
		                  "requestSchema": "./requestParams.json",
		                  "type": "Query",
		                },
		              ],
		            },
		          },
		          "name": "<json_source_name>",
		        },
		      ],
		    },
		  },
		]
	`);

		expect(output).toMatchInlineSnapshot(`
		{
		  "imsOrgId": "1234",
		  "meshConfig": {
		    "files": [
		      {
		        "content": "{"type":"updatedContent"}",
		        "path": "./requestParams.json",
		      },
		    ],
		    "sources": [
		      {
		        "handler": {
		          "JsonSchema": {
		            "baseUrl": "<json_source__baseurl>",
		            "operations": [
		              {
		                "field": "<query>",
		                "method": "POST",
		                "path": "<query_path>",
		                "requestSchema": "./requestParams.json",
		                "type": "Query",
		              },
		            ],
		          },
		        },
		        "name": "<json_source_name>",
		      },
		    ],
		  },
		  "meshId": "dummy_mesh_id",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
	});

	test('should fail if the file name is more than 25 characters', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_invalid_file_name.json' },
			flags: {
				autoConfirmAction: Promise.resolve(false),
			},
		});

		const output = CreateCommand.run();

		await expect(output).rejects.toEqual(new Error('Input mesh config is not valid.'));

		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Mesh file names must be less than 25 characters. The following file(s) are invalid: requestJSONParameters.json.",
		  ],
		]
	`);

		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Input mesh config is not valid.",
		  ],
		]
	`);
	});

	test('should fail if the file is of type other than js, json extension', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_invalid_type.json' },
			flags: {
				autoConfirmAction: Promise.resolve(false),
			},
		});

		const output = CreateCommand.run();

		await expect(output).rejects.toEqual(new Error('Input mesh config is not valid.'));

		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Mesh files must be JavaScript or JSON. Other file types are not supported. The following file(s) are invalid: requestParams.txt.",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Input mesh config is not valid.",
		  ],
		]
	`);
	});

	test('should fail if the files do not exist in the mesh directory or subdirectory', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_invalid_paths.json' },
			flags: {
				autoConfirmAction: Promise.resolve(false),
			},
		});

		importFiles.mockImplementation(() => {
			throw new Error(
				'Please make sure the files: schemaBody.json and sample_mesh_invalid_paths.json are in the same directory/subdirectory.',
			);
		});

		const output = CreateCommand.run();
		await expect(output).rejects.toEqual(
			new Error('Unable to import the files in the mesh config. Check the file and try again.'),
		);

		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Please make sure the files: schemaBody.json and sample_mesh_invalid_paths.json are in the same directory/subdirectory.",
		  ],
		]
	`);

		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to import the files in the mesh config. Check the file and try again.",
		  ],
		]
	`);
	});

	test('should fail if import files function fails', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_files.json' },
			flags: {
				autoConfirmAction: Promise.resolve(false),
			},
		});

		importFiles.mockImplementation(() => {
			throw new Error('Error reading the file');
		});

		const output = CreateCommand.run();

		await expect(output).rejects.toEqual(
			new Error('Unable to import the files in the mesh config. Check the file and try again.'),
		);

		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Error reading the file",
		  ],
		]
	`);

		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to import the files in the mesh config. Check the file and try again.",
		  ],
		]
	`);
	});

	// Temporarily skipping since it is not actually testing the file import override prompt. The function which performs the prompt is mocked.
	test.skip('should not override if prompt returns No, if there is files array', async () => {
		let meshConfig = {
			sources: [
				{
					name: '<json_source_name>',
					handler: {
						JsonSchema: {
							baseUrl: '<json_source__baseurl>',
							operations: [
								{
									type: 'Query',
									field: '<query>',
									path: '<query_path>',
									method: 'POST',
									requestSchema: './requestParams.json',
								},
							],
						},
					},
				},
			],
			files: [
				{
					path: './requestParams.json',
					content: '{"type":"dummyContent"}',
				},
			],
		};

		promptConfirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

		importFiles.mockResolvedValueOnce(meshConfig);

		createMesh.mockResolvedValueOnce({
			mesh: {
				meshId: 'dummy_mesh_id',
				meshConfig: meshConfig,
			},
		});

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_files_array.json' },
			flags: {
				autoConfirmAction: Promise.resolve(true),
			},
		});

		const output = await CreateCommand.run();

		expect(initRequestId).toHaveBeenCalled();
		expect(createMesh.mock.calls[0]).toMatchInlineSnapshot(`
		[
		  "1234",
		  "5678",
		  "123456789",
		  "Workspace01",
		  "ORG01",
		  "Project01",
		  {
		    "files": [
		      {
		        "content": "{"type":"dummyContent"}",
		        "path": "./requestParams.json",
		      },
		    ],
		    "sources": [
		      {
		        "handler": {
		          "JsonSchema": {
		            "baseUrl": "<json_source__baseurl>",
		            "operations": [
		              {
		                "field": "<query>",
		                "method": "POST",
		                "path": "<query_path>",
		                "requestSchema": "./requestParams.json",
		                "type": "Query",
		              },
		            ],
		          },
		        },
		        "name": "<json_source_name>",
		      },
		    ],
		  },
		]
	`);
		expect(output).toMatchInlineSnapshot(`
		{
		  "mesh": {
		    "meshConfig": {
		      "files": [
		        {
		          "content": "{"type":"dummyContent"}",
		          "path": "./requestParams.json",
		        },
		      ],
		      "sources": [
		        {
		          "handler": {
		            "JsonSchema": {
		              "baseUrl": "<json_source__baseurl>",
		              "operations": [
		                {
		                  "field": "<query>",
		                  "method": "POST",
		                  "path": "<query_path>",
		                  "requestSchema": "./requestParams.json",
		                  "type": "Query",
		                },
		              ],
		            },
		          },
		          "name": "<json_source_name>",
		        },
		      ],
		    },
		    "meshId": "dummy_mesh_id",
		  },
		}
	`);
	});

	// Temporarily skipping since it is not actually testing the file import override prompt. The function which performs the prompt is mocked.
	test.skip('should override if prompt returns Yes, if there is files array', async () => {
		let meshConfig = {
			sources: [
				{
					name: '<json_source_name>',
					handler: {
						JsonSchema: {
							baseUrl: '<json_source__baseurl>',
							operations: [
								{
									type: 'Query',
									field: '<query>',
									path: '<query_path>',
									method: 'POST',
									requestSchema: './requestParams.json',
								},
							],
						},
					},
				},
			],
			files: [
				{
					path: './requestParams.json',
					content: '{"type":"updatedContent"}',
				},
			],
		};

		promptConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_files_array.json' },
			flags: {
				autoConfirmAction: Promise.resolve(true),
			},
		});

		importFiles.mockResolvedValueOnce({
			meshConfig,
		});

		createMesh.mockResolvedValueOnce({
			mesh: {
				meshId: 'dummy_mesh_id',
				meshConfig: meshConfig,
			},
		});

		const output = await CreateCommand.run();

		expect(initRequestId).toHaveBeenCalled();
		expect(createMesh.mock.calls[0]).toMatchInlineSnapshot(`
		[
		  "1234",
		  "5678",
		  "123456789",
		  "Workspace01",
		  "ORG01",
		  "Project01",
		  {
		    "meshConfig": {
		      "files": [
		        {
		          "content": "{"type":"updatedContent"}",
		          "path": "./requestParams.json",
		        },
		      ],
		      "sources": [
		        {
		          "handler": {
		            "JsonSchema": {
		              "baseUrl": "<json_source__baseurl>",
		              "operations": [
		                {
		                  "field": "<query>",
		                  "method": "POST",
		                  "path": "<query_path>",
		                  "requestSchema": "./requestParams.json",
		                  "type": "Query",
		                },
		              ],
		            },
		          },
		          "name": "<json_source_name>",
		        },
		      ],
		    },
		  },
		]
	`);

		expect(output).toMatchInlineSnapshot(`
		{
		  "mesh": {
		    "meshConfig": {
		      "files": [
		        {
		          "content": "{"type":"updatedContent"}",
		          "path": "./requestParams.json",
		        },
		      ],
		      "sources": [
		        {
		          "handler": {
		            "JsonSchema": {
		              "baseUrl": "<json_source__baseurl>",
		              "operations": [
		                {
		                  "field": "<query>",
		                  "method": "POST",
		                  "path": "<query_path>",
		                  "requestSchema": "./requestParams.json",
		                  "type": "Query",
		                },
		              ],
		            },
		          },
		          "name": "<json_source_name>",
		        },
		      ],
		    },
		    "meshId": "dummy_mesh_id",
		  },
		}
	`);
	});

	test('should pass for a fully-qualified meshConfig even if the file does not exist in fileSystem', async () => {
		let meshConfig = {
			sources: [
				{
					name: '<json_source_name>',
					handler: {
						JsonSchema: {
							baseUrl: '<json_source__baseurl>',
							operations: [
								{
									type: 'Query',
									field: '<query>',
									path: '<query_path>',
									method: 'POST',
									requestSchema: './schemaBody.json',
								},
							],
						},
					},
				},
			],
			files: [
				{
					path: './schemaBody.json',
					content: '{"type":"dummyContent"}',
				},
			],
		};

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_fully_qualified_mesh.json' },
			flags: {
				autoConfirmAction: Promise.resolve(true),
			},
		});

		promptConfirm.mockResolvedValueOnce(true);

		importFiles.mockResolvedValueOnce({
			meshConfig,
		});

		createMesh.mockResolvedValueOnce({
			mesh: {
				meshId: 'dummy_mesh_id',
				meshConfig: meshConfig,
			},
		});

		const output = await CreateCommand.run();

		expect(initRequestId).toHaveBeenCalled();
		expect(createMesh.mock.calls[0]).toMatchInlineSnapshot(`
		[
		  "CODE1234@AdobeOrg",
		  "5678",
		  "123456789",
		  "Workspace01",
		  "ORG01",
		  "Project01",
		  {
		    "meshConfig": {
		      "files": [
		        {
		          "content": "{"type":"dummyContent"}",
		          "path": "./schemaBody.json",
		        },
		      ],
		      "sources": [
		        {
		          "handler": {
		            "JsonSchema": {
		              "baseUrl": "<json_source__baseurl>",
		              "operations": [
		                {
		                  "field": "<query>",
		                  "method": "POST",
		                  "path": "<query_path>",
		                  "requestSchema": "./schemaBody.json",
		                  "type": "Query",
		                },
		              ],
		            },
		          },
		          "name": "<json_source_name>",
		        },
		      ],
		    },
		  },
		]
	`);
		expect(output).toMatchInlineSnapshot(`
		{
		  "imsOrgId": "1234",
		  "meshConfig": {
		    "files": [
		      {
		        "content": "{"type":"dummyContent"}",
		        "path": "./schemaBody.json",
		      },
		    ],
		    "sources": [
		      {
		        "handler": {
		          "JsonSchema": {
		            "baseUrl": "<json_source__baseurl>",
		            "operations": [
		              {
		                "field": "<query>",
		                "method": "POST",
		                "path": "<query_path>",
		                "requestSchema": "./schemaBody.json",
		                "type": "Query",
		              },
		            ],
		          },
		        },
		        "name": "<json_source_name>",
		      },
		    ],
		  },
		  "meshId": "dummy_mesh_id",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
	});

	test('should pass if the file is located in subdirectory of mesh directory', async () => {
		let meshConfig = {
			sources: [
				{
					name: '<json_source_name>',
					handler: {
						JsonSchema: {
							baseUrl: '<json_source__baseurl>',
							operations: [
								{
									type: 'Query',
									field: '<query>',
									path: '<query_path>',
									method: 'POST',
									requestSchema: './files/requestParams.json',
								},
							],
						},
					},
				},
			],
			files: [
				{
					path: './files/requestParams.json',
					content: '{"type":"updatedContent"}',
				},
			],
		};

		createMesh.mockResolvedValueOnce({
			mesh: {
				meshId: 'dummy_mesh_id',
				meshConfig: meshConfig,
			},
		});

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_subdirectory.json' },
			flags: {
				autoConfirmAction: Promise.resolve(true),
			},
		});

		importFiles.mockResolvedValueOnce({
			meshConfig,
		});

		const output = await CreateCommand.run();

		expect(initRequestId).toHaveBeenCalled();
		expect(createMesh.mock.calls[0]).toMatchInlineSnapshot(`
		[
		  "CODE1234@AdobeOrg",
		  "5678",
		  "123456789",
		  "Workspace01",
		  "ORG01",
		  "Project01",
		  {
		    "meshConfig": {
		      "files": [
		        {
		          "content": "{"type":"updatedContent"}",
		          "path": "./files/requestParams.json",
		        },
		      ],
		      "sources": [
		        {
		          "handler": {
		            "JsonSchema": {
		              "baseUrl": "<json_source__baseurl>",
		              "operations": [
		                {
		                  "field": "<query>",
		                  "method": "POST",
		                  "path": "<query_path>",
		                  "requestSchema": "./files/requestParams.json",
		                  "type": "Query",
		                },
		              ],
		            },
		          },
		          "name": "<json_source_name>",
		        },
		      ],
		    },
		  },
		]
	`);
		expect(output).toMatchInlineSnapshot(`
		{
		  "imsOrgId": "1234",
		  "meshConfig": {
		    "files": [
		      {
		        "content": "{"type":"updatedContent"}",
		        "path": "./files/requestParams.json",
		      },
		    ],
		    "sources": [
		      {
		        "handler": {
		          "JsonSchema": {
		            "baseUrl": "<json_source__baseurl>",
		            "operations": [
		              {
		                "field": "<query>",
		                "method": "POST",
		                "path": "<query_path>",
		                "requestSchema": "./files/requestParams.json",
		                "type": "Query",
		              },
		            ],
		          },
		        },
		        "name": "<json_source_name>",
		      },
		    ],
		  },
		  "meshId": "dummy_mesh_id",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
	});

	test('should fail if the file is outside the workspace directory', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_outside_workspace_dir.json' },
			flags: {
				autoConfirmAction: Promise.resolve(false),
			},
		});

		const output = CreateCommand.run();

		await expect(output).rejects.toEqual(new Error('Input mesh config is not valid.'));
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "File(s): requestParams.json is outside the mesh directory.",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Input mesh config is not valid.",
		  ],
		]
	`);
	});

	test('should fail if the file has invalid JSON content', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_invalid_file_content.json' },
			flags: {
				autoConfirmAction: Promise.resolve(false),
			},
		});

		importFiles.mockImplementation(() => {
			throw new Error('Invalid JSON content in openapi-schema.json');
		});

		const output = CreateCommand.run();

		await expect(output).rejects.toEqual(
			new Error('Unable to import the files in the mesh config. Check the file and try again.'),
		);

		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Invalid JSON content in openapi-schema.json",
		  ],
		]
	`);

		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to import the files in the mesh config. Check the file and try again.",
		  ],
		]
	`);
	});

	test('should fail if the file path starts from home directory i.e., path starts with ~/', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_path_from_home.json' },
			flags: {
				autoConfirmAction: Promise.resolve(false),
			},
		});

		const output = CreateCommand.run();

		await expect(output).rejects.toEqual(new Error('Input mesh config is not valid.'));
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "File(s): venia-openapi-schema.json is outside the mesh directory.",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Input mesh config is not valid.",
		  ],
		]
	`);
	});

	test('should show prod edge mesh url on workspace named "Production" if feature is enabled', async () => {
		// mock the edge mesh url feature to be enabled
		getTenantFeatures.mockResolvedValue({
			imsOrgId: selectedOrg.code,
			showCloudflareURL: true,
		});

		// mock the workspace name to "Production"
		initSdk.mockResolvedValue({
			workspaceName: 'Production',
		});

		await CreateCommand.run();

		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining('Mesh Endpoint:'),
			'https://edge-graph.adobe.io/api/dummy_mesh_id/graphql',
		);
	});

	test('should show sandbox edge mesh url on workspace NOT named "Production" if feature is enabled', async () => {
		// mock the edge mesh url feature to be enabled
		getTenantFeatures.mockResolvedValueOnce({
			imsOrgId: selectedOrg.code,
			showCloudflareURL: true,
		});

		// mock the workspace name to a value not equal to "Production"
		initSdk.mockResolvedValueOnce({
			workspaceName: 'AnythingButProduction',
		});

		await CreateCommand.run();

		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining('Mesh Endpoint:'),
			'https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql',
		);
	});

	test('should return error if mesh has placeholders and the provided secrets file is invalid', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_secrets_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: Promise.resolve(true),
				secrets: 'src/commands/__fixtures__/secrets_invalid.yaml',
			},
		});

		const runResult = CreateCommand.run();

		await expect(runResult).rejects.toEqual(
			new Error('Unable to import secrets. Check the file and try again.'),
		);

		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to import secrets. Check the file and try again.",
		  ],
		]
	`);
	});

	test('should return error if mesh has placeholders and the provided secrets file is not yaml or yml', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_secrets_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: Promise.resolve(true),
				secrets: 'src/commands/__fixtures__/.secrets_file.env',
			},
		});

		const runResult = CreateCommand.run();

		await expect(runResult).rejects.toEqual(
			new Error('Unable to import secrets. Check the file and try again.'),
		);

		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Invalid file format. Please provide a YAML file (.yaml or .yml).",
		  ],
		]
	`);

		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to import secrets. Check the file and try again.",
		  ],
		]
	`);
	});

	test('should successfully create a mesh if provided secrets file is valid', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_secrets_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: Promise.resolve(true),
				secrets: 'src/commands/__fixtures__/secrets_valid.yaml',
			},
		});

		crypto.randomBytes.mockReturnValueOnce(mockAesKey).mockReturnValueOnce(mockIv);
		crypto.createCipheriv.mockReturnValueOnce(mockCipher);
		crypto.publicEncrypt.mockReturnValueOnce(mockEncryptedAesKey);

		const runResult = await CreateCommand.run();
		expect(runResult).toMatchInlineSnapshot(`
		{
		  "imsOrgId": "1234",
		  "meshConfig": {
		    "sources": [
		      {
		        "handler": {
		          "graphql": {
		            "endpoint": "<gql_endpoint>",
		          },
		        },
		        "name": "<api_name>",
		      },
		    ],
		  },
		  "meshId": "dummy_mesh_id",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
	});

	test('should return error if ran against windows platform with batch variables', async () => {
		platformSpy.mockReturnValue('win32');
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_secrets_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: Promise.resolve(true),
				secrets: 'src/commands/__fixtures__/secrets_with_batch_variables.yaml',
			},
		});

		const runResult = CreateCommand.run();

		await expect(runResult).rejects.toEqual(
			new Error('Unable to import secrets. Check the file and try again.'),
		);

		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Batch variables are not supported in YAML files on Windows.",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to import secrets. Check the file and try again.",
		  ],
		]
	`);
	});

	test('should pass if ran against linux platform with batch variables', async () => {
		platformSpy.mockReturnValue('linux');
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_secrets_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: Promise.resolve(true),
				secrets: 'src/commands/__fixtures__/secrets_with_batch_variables.yaml',
			},
		});

		crypto.randomBytes.mockReturnValueOnce(mockAesKey).mockReturnValueOnce(mockIv);
		crypto.createCipheriv.mockReturnValueOnce(mockCipher);
		crypto.publicEncrypt.mockReturnValueOnce(mockEncryptedAesKey);

		const runResult = await CreateCommand.run();
		expect(runResult).toMatchInlineSnapshot(`
		{
		  "imsOrgId": "1234",
		  "meshConfig": {
		    "sources": [
		      {
		        "handler": {
		          "graphql": {
		            "endpoint": "<gql_endpoint>",
		          },
		        },
		        "name": "<api_name>",
		      },
		    ],
		  },
		  "meshId": "dummy_mesh_id",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
	});

	test('should pass if ran against darwin(macOS) platform with batch variables', async () => {
		platformSpy.mockReturnValue('darwin');
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_secrets_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: Promise.resolve(true),
				secrets: 'src/commands/__fixtures__/secrets_with_batch_variables.yaml',
			},
		});

		crypto.randomBytes.mockReturnValueOnce(mockAesKey).mockReturnValueOnce(mockIv);
		crypto.createCipheriv.mockReturnValueOnce(mockCipher);
		crypto.publicEncrypt.mockReturnValueOnce(mockEncryptedAesKey);

		const runResult = await CreateCommand.run();
		expect(runResult).toMatchInlineSnapshot(`
		{
		  "imsOrgId": "1234",
		  "meshConfig": {
		    "sources": [
		      {
		        "handler": {
		          "graphql": {
		            "endpoint": "<gql_endpoint>",
		          },
		        },
		        "name": "<api_name>",
		      },
		    ],
		  },
		  "meshId": "dummy_mesh_id",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_mesh_id/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
	});

	test('should return error if secrets file is valid but public key for encryption is empty', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_secrets_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: Promise.resolve(true),
				secrets: 'src/commands/__fixtures__/secrets_valid.yaml',
			},
		});
		getPublicEncryptionKey.mockResolvedValue('');

		crypto.randomBytes.mockReturnValueOnce(mockAesKey).mockReturnValueOnce(mockIv);
		crypto.createCipheriv.mockReturnValueOnce(mockCipher);

		const runResult = CreateCommand.run();
		await expect(runResult).rejects.toEqual(
			new Error('Unable to import secrets. Check the file and try again.'),
		);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to encrypt secerts. Invalid Public Key.",
		  ],
		]
	`);
	});
});
