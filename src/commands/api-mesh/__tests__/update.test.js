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

jest.mock('axios');
jest.mock('fs/promises');
jest.mock('@adobe/aio-lib-env');
jest.mock('../../../helpers', () => ({
	initSdk: jest.fn().mockResolvedValue({}),
	initRequestId: jest.fn().mockResolvedValue({}),
	promptConfirm: jest.fn().mockResolvedValue(true),
	importFiles: jest.fn().mockResolvedValue(),
}));
jest.mock('@adobe/aio-cli-lib-console', () => ({
	init: jest.fn().mockResolvedValue(mockConsoleCLIInstance),
	cleanStdOut: jest.fn(),
}));
jest.mock('@adobe/aio-lib-ims');
jest.mock('../../../lib/devConsole');

const mockConsoleCLIInstance = {};

const selectedOrg = { id: '1234', code: 'CODE1234@AdobeOrg', name: 'ORG01', type: 'entp' };
const selectedProject = { id: '5678', title: 'Project01' };
const selectedWorkspace = { id: '123456789', title: 'Workspace01' };

const { readFile } = require('fs/promises');

const UpdateCommand = require('../update');
const { initSdk, initRequestId, promptConfirm, importFiles } = require('../../../helpers');
const { getMeshId, updateMesh } = require('../../../lib/devConsole');

let logSpy = null;
let errorLogSpy = null;

let parseSpy = null;

const mockIgnoreCacheFlag = Promise.resolve(true);
const mockAutoApproveAction = Promise.resolve(false);

describe('update command tests', () => {
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

		logSpy = jest.spyOn(UpdateCommand.prototype, 'log');
		errorLogSpy = jest.spyOn(UpdateCommand.prototype, 'error');

		readFile.mockResolvedValue('{}');

		getMeshId.mockResolvedValue('mesh_id');
		updateMesh.mockResolvedValue({ status: 'success' });

		parseSpy = jest.spyOn(UpdateCommand.prototype, 'parse');
		parseSpy.mockResolvedValue({
			args: { file: 'valid_file_path' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
			},
		});
	});

	test('should pass with valid args', async () => {
		let sampleMesh = {
			meshConfig: {
				sources: [
					{
						name: '<api_name>',
						handler: {
							graphql: {
								endpoint: '<gql_endpoint>',
							},
						},
					},
				],
			},
		};
		readFile.mockResolvedValueOnce(JSON.stringify(sampleMesh));

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
			},
		});

		const runResult = await UpdateCommand.run();

		expect(runResult).toMatchInlineSnapshot(`
		{
		  "status": "success",
		}
	`);
		expect(initRequestId).toHaveBeenCalled();
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
		    "mesh_id",
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
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`[]`);
	});

	test('should pass with valid args and ignoreCache flag', async () => {
		let sampleMesh = {
			meshConfig: {
				sources: [
					{
						name: '<api_name>',
						handler: {
							graphql: {
								endpoint: '<gql_endpoint>',
							},
						},
					},
				],
			},
		};
		readFile.mockResolvedValueOnce(JSON.stringify(sampleMesh));

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: {
				ignoreCache: Promise.resolve(true),
				autoConfirmAction: mockAutoApproveAction,
			},
		});

		const runResult = await UpdateCommand.run();

		expect(runResult).toMatchInlineSnapshot(`
		{
		  "status": "success",
		}
	`);
		expect(initRequestId).toHaveBeenCalled();
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
		    "mesh_id",
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
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`[]`);
	});

	test('should pass with valid args if autoConfirmAction flag is set', async () => {
		let sampleMesh = {
			meshConfig: {
				sources: [
					{
						name: '<api_name>',
						handler: {
							graphql: {
								endpoint: '<gql_endpoint>',
							},
						},
					},
				],
			},
		};
		readFile.mockResolvedValueOnce(JSON.stringify(sampleMesh));

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: Promise.resolve(true),
			},
		});

		const runResult = await UpdateCommand.run();

		expect(runResult).toMatchInlineSnapshot(`
		{
		  "status": "success",
		}
	`);
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
		    "mesh_id",
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
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`[]`);
	});

	test('should fail if mesh id is missing', async () => {
		let sampleMesh = {
			meshConfig: {
				sources: [
					{
						name: '<api_name>',
						handler: {
							graphql: {
								endpoint: '<gql_endpoint>',
							},
						},
					},
				],
			},
		};
		readFile.mockResolvedValueOnce(JSON.stringify(sampleMesh));

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
			},
		});

		getMeshId.mockResolvedValueOnce(null);
		const runResult = UpdateCommand.run();

		await expect(runResult).rejects.toMatchInlineSnapshot(
			`[Error: Unable to update. No mesh found for Org(1234) -> Project(5678) -> Workspace(123456789). Please check the details and try again.]`,
		);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`[]`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to update. No mesh found for Org(1234) -> Project(5678) -> Workspace(123456789). Please check the details and try again.",
		  ],
		]
	`);
	});

	test('should fail if getMeshId api failed', async () => {
		let sampleMesh = {
			meshConfig: {
				sources: [
					{
						name: '<api_name>',
						handler: {
							graphql: {
								endpoint: '<gql_endpoint>',
							},
						},
					},
				],
			},
		};
		readFile.mockResolvedValueOnce(JSON.stringify(sampleMesh));

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
			},
		});

		getMeshId.mockRejectedValue(new Error('getMeshId api failed'));
		const runResult = UpdateCommand.run();

		await expect(runResult).rejects.toMatchInlineSnapshot(
			`[Error: Unable to get mesh ID. Check the details and try again. RequestId: dummy_request_id]`,
		);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`[]`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to get mesh ID. Check the details and try again. RequestId: dummy_request_id",
		  ],
		]
	`);
	});

	test('should fail if updateMesh method failed', async () => {
		let sampleMesh = {
			meshConfig: {
				sources: [
					{
						name: '<api_name>',
						handler: {
							graphql: {
								endpoint: '<gql_endpoint>',
							},
						},
					},
				],
			},
		};
		readFile.mockResolvedValueOnce(JSON.stringify(sampleMesh));

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
			},
		});

		updateMesh.mockRejectedValueOnce(new Error('dummy_error'));

		const runResult = UpdateCommand.run();

		// await expect(runResult).rejects.toEqual(
		// 	new Error(
		// 		'Unable to update the mesh. Please check the mesh configuration file and try again. If the error persists please contact support. RequestId: dummy_request_id',
		// 	),
		// );

		await expect(runResult).rejects.toMatchInlineSnapshot(
			`[Error: Unable to update the mesh. Check the mesh configuration file and try again. If the error persists please contact support. RequestId: dummy_request_id]`,
		);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "dummy_error",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to update the mesh. Check the mesh configuration file and try again. If the error persists please contact support. RequestId: dummy_request_id",
		  ],
		]
	`);
	});

	test('should fail if update file path is missing', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: null },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
			},
		});
		const runResult = UpdateCommand.run();

		await expect(runResult).rejects.toEqual(
			new Error('Missing required args. Run aio api-mesh update --help for more info.'),
		);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`[]`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Missing required args. Run aio api-mesh update --help for more info.",
		  ],
		]
	`);
	});

	test('should fail if dummy file path is provided', async () => {
		readFile.mockRejectedValueOnce(new Error('File not found'));
		const runResult = UpdateCommand.run();

		await expect(runResult).rejects.toEqual(
			new Error(
				'Unable to read the mesh configuration file provided. Please check the file and try again.',
			),
		);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "File not found",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to read the mesh configuration file provided. Please check the file and try again.",
		  ],
		]
	`);
	});

	test('should not update if user prompt returns false', async () => {
		let sampleMesh = {
			meshConfig: {
				sources: [
					{
						name: '<api_name>',
						handler: {
							graphql: {
								endpoint: '<gql_endpoint>',
							},
						},
					},
				],
			},
		};
		readFile.mockResolvedValueOnce(JSON.stringify(sampleMesh));

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
			},
		});

		promptConfirm.mockResolvedValueOnce(false);

		const runResult = await UpdateCommand.run();

		expect(runResult).toMatchInlineSnapshot(`"Update cancelled"`);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Update cancelled",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`[]`);
	});

	test('should pass if there are local files in meshConfig i.e., the file is appended in files array', async () => {
		let sampleMesh = {
			meshConfig: {
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
			},
		};
		readFile.mockResolvedValueOnce(JSON.stringify(sampleMesh));

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

		updateMesh.mockResolvedValueOnce({
			meshId: 'dummy_mesh_id',
			meshConfig: meshConfig,
		});

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_files.json' },
			flags: {
				autoConfirmAction: mockAutoApproveAction,
			},
		});

		importFiles.mockResolvedValueOnce({
			meshConfig,
		});

		const output = await UpdateCommand.run();

		expect(initRequestId).toHaveBeenCalled();
		expect(updateMesh.mock.calls[0]).toMatchInlineSnapshot(`
		[
		  "CODE1234@AdobeOrg",
		  "5678",
		  "123456789",
		  "Workspace01",
		  "ORG01",
		  "Project01",
		  "mesh_id",
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
		}
	`);
	});

	test('should fail if the input mesh config file is inavlid i.e., file name has more than 25 characters', async () => {
		let sampleMesh = {
			meshConfig: {
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
										requestSchema: './requestJSONParameters.json',
									},
								],
							},
						},
					},
				],
			},
		};
		readFile.mockResolvedValueOnce(JSON.stringify(sampleMesh));

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_invalid_file_name.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
			},
		});

		const output = UpdateCommand.run();

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

	test('should fail if the import files function fails', async () => {
		let sampleMesh = {
			meshConfig: {
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
			},
		};
		readFile.mockResolvedValueOnce(JSON.stringify(sampleMesh));

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_files.json' },
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
				autoConfirmAction: mockAutoApproveAction,
			},
		});

		importFiles.mockImplementation(() => {
			throw new Error('Error reading the file.');
		});

		const output = UpdateCommand.run();
		await expect(output).rejects.toEqual(
			new Error('Unable to import the files in the mesh config. Check the file and try again.'),
		);

		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Error reading the file.",
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
});
