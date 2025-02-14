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

const RunCommand = require('../run');
const {
	interpolateMesh,
	importFiles,
	promptConfirm,
	setUpTenantFiles,
	initSdk,
	writeSecretsFile,
} = require('../../../helpers');
const { runServer } = require('../../../server');
const { getMeshId, getMeshArtifact } = require('../../../lib/devConsole');
require('@adobe-apimesh/mesh-builder');

jest.mock('../../../helpers', () => ({
	initSdk: jest.fn().mockResolvedValue({
		imsOrgCode: 'mockOrgCode',
		projectId: 'mockProjectId',
		workspaceId: 'mockWorkspaceId',
		workspaceName: 'mockWorkspaceTitle',
	}),
	initRequestId: jest.fn().mockResolvedValue({}),
	interpolateMesh: jest.fn().mockResolvedValue({}),
	importFiles: jest.fn().mockResolvedValue(),
	promptConfirm: jest.fn().mockResolvedValue(true),
	setUpTenantFiles: jest.fn().mockResolvedValue(),
	writeSecretsFile: jest.fn().mockResolvedValue(),
}));

jest.mock('../../../server', () => ({
	runServer: jest.fn().mockResolvedValue(),
}));

jest.mock('../../../lib/devConsole', () => ({
	getMeshId: jest.fn().mockResolvedValue('mockMeshId'),
	getMeshArtifact: jest.fn().mockResolvedValue(),
}));
jest.mock('chalk', () => ({
	red: jest.fn(text => text), // Return the input text without any color formatting
}));

jest.mock('@adobe-apimesh/mesh-builder', () => {
	return {
		default: {
			validateMesh: jest.fn().mockResolvedValue({}),
			buildMesh: jest.fn().mockResolvedValue({}),
			compileMesh: jest.fn().mockResolvedValue({}),
		},
	};
});

jest.mock('envsub/js/envsub-parser', () => {
	return contents => {
		return contents.replaceAll('$HOME', 'rootPath');
	};
});

let logSpy = null;
let errorLogSpy = null;
let parseSpy = null;
let platformSpy = null;

const originalEnv = {
	API_MESH_TIER: 'NON-TI',
};

const defaultPort = 5000;
const os = require('os');

describe('run command tests', () => {
	beforeEach(() => {
		global.requestId = 'dummy_request_id';

		logSpy = jest.spyOn(RunCommand.prototype, 'log');
		errorLogSpy = jest.spyOn(RunCommand.prototype, 'error');
		parseSpy = jest.spyOn(RunCommand.prototype, 'parse');
		platformSpy = jest.spyOn(os, 'platform');
		process.env = {
			...originalEnv,
		};
	});
	afterEach(() => {
		platformSpy.mockRestore();
	});

	beforeAll(() => {
		jest.spyOn(RunCommand.prototype, 'copyMeshContent').mockImplementation(() => {});
	});

	test('snapshot run command description', () => {
		expect(RunCommand.description).toMatchInlineSnapshot(
			`"Run a local development server that builds and compiles a mesh locally"`,
		);
		expect(RunCommand.summary).toMatchInlineSnapshot(`"Run local development server"`);
		expect(RunCommand.args).toMatchInlineSnapshot(`
		[
		  {
		    "description": "Mesh File",
		    "name": "file",
		  },
		]
	`);

		expect(RunCommand.flags).toMatchInlineSnapshot(`
		{
		  "autoConfirmAction": {
		    "allowNo": false,
		    "char": "c",
		    "default": false,
		    "description": "Auto confirm action prompt. CLI will not check for user approval before executing the action.",
		    "parse": [Function],
		    "type": "boolean",
		  },
		  "debug": {
		    "allowNo": false,
		    "default": false,
		    "description": "Enable debugging mode",
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
		  "port": {
		    "char": "p",
		    "description": "Port number for the local dev server",
		    "input": [],
		    "multiple": false,
		    "parse": [Function],
		    "type": "option",
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
		  "select": {
		    "allowNo": false,
		    "default": false,
		    "description": "Retrieve existing artifacts from the mesh",
		    "parse": [Function],
		    "type": "boolean",
		  },
		}
	`);
		expect(RunCommand.aliases).toMatchInlineSnapshot(`[]`);
	});

	test('should fail if mesh file is not provided', async () => {
		parseSpy.mockResolvedValue({
			args: {},
			flags: {},
		});

		const runResult = RunCommand.run();
		await expect(runResult).rejects.toEqual(
			new Error('Missing file path. Run aio api-mesh run --help for more info.'),
		);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`[]`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Missing file path. Run aio api-mesh run --help for more info.",
		  ],
		]
	`);
	});

	test('should use the port number provided in the flags for starting the server', async () => {
		const parseOutput = {
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: { port: 6000, debug: false },
		};

		parseSpy.mockResolvedValue(parseOutput);

		await RunCommand.run();
		expect(runServer).toHaveBeenCalledWith(parseOutput.flags.port);
	});

	test('should use the port number provided in the .env file if there is no port', async () => {
		process.env = {
			...originalEnv,
			PORT: 7000,
		};

		const parseOutput = {
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: { debug: false },
		};

		parseSpy.mockResolvedValue(parseOutput);

		await RunCommand.run();
		expect(runServer).toHaveBeenCalledWith(process.env.PORT);
	});

	test('should use the default port if port number is not provided explicitly', async () => {
		process.env = {
			...originalEnv,
		};

		const parseOutput = {
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: { debug: false },
		};

		parseSpy.mockResolvedValue(parseOutput);

		await RunCommand.run();
		expect(runServer).toHaveBeenCalledWith(defaultPort);
	});

	test('should return error for run command if the mesh has placeholders and env file provided using --env flag is not found', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_placeholder' },
			flags: {
				env: 'src/commands/__fixtures__/.env_nonExisting',
			},
		});
		const runResult = RunCommand.run();

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
		  [
		    "Unable to read the file src/commands/__fixtures__/.env_nonExisting. Please check the file and try again.",
		  ],
		]
	`);
	});

	test('should return error for run command if mesh has placeholders and the provided env file is invalid', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_placeholder' },
			flags: {
				env: 'src/commands/__fixtures__/env_invalid',
			},
		});

		const runResult = RunCommand.run();

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
		  [
		    "Issue in src/commands/__fixtures__/env_invalid file - Interpolated mesh is not a valid JSON. Please check the generated json file.",
		  ],
		]
	`);
	});

	test('should return error for run command if the mesh has placeholders and the provided env file is valid but there are missing keys found in mesh interpolation', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_placeholder' },
			flags: {
				env: 'src/commands/__fixtures__/env_valid',
			},
		});

		interpolateMesh.mockResolvedValueOnce({
			interpolationStatus: 'failed',
			missingKeys: ['newKey1', 'newKey2'],
			interpolatedMesh: '',
		});

		const runResult = RunCommand.run();
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
		  [
		    "Issue in src/commands/__fixtures__/env_valid file - The mesh file cannot be interpolated due to missing keys : newKey1 , newKey2",
		  ],
		]
	`);
	});

	test('should return error for run command if the provided env file is valid and mesh interpolation is successful but interpolated mesh is not a valid JSON', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_placeholder' },
			flags: {
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

		const runResult = RunCommand.run();
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
		  [
		    "Issue in src/commands/__fixtures__/env_valid file - Interpolated mesh is not a valid JSON. Please check the generated json file.",
		  ],
		]
	`);
	});

	test('should successfully run the mesh if provided env file is valid, mesh interpolation is successful and interpolated mesh is a valid JSON', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_placeholder' },
			flags: {
				env: 'src/commands/__fixtures__/env_valid',
				debug: false,
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

		await RunCommand.run();
		expect(runServer).toHaveBeenCalledWith(defaultPort);
	});

	// file import tests
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

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_files.json' },
			flags: {
				autoConfirmAction: Promise.resolve(true),
				debug: false,
			},
		});

		importFiles.mockResolvedValueOnce({
			meshConfig,
		});

		await RunCommand.run();
		expect(runServer).toHaveBeenCalledWith(defaultPort);
	});

	test('should fail if the file name is more than 25 characters', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_invalid_file_name.json' },
			flags: {
				autoConfirmAction: Promise.resolve(false),
			},
		});

		const output = RunCommand.run();

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

		const output = RunCommand.run();

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

		const output = RunCommand.run();
		await expect(output).rejects.toEqual(
			new Error(
				'Unable to import the files in the mesh config. Please check the file and try again.',
			),
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
		    "Unable to import the files in the mesh config. Please check the file and try again.",
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

		const output = RunCommand.run();

		await expect(output).rejects.toEqual(
			new Error(
				'Unable to import the files in the mesh config. Please check the file and try again.',
			),
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
		    "Unable to import the files in the mesh config. Please check the file and try again.",
		  ],
		]
	`);
	});

	test('should not override if prompt returns No, if there is files array', async () => {
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

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_files_array.json' },
			flags: {
				debug: false,
			},
		});

		await RunCommand.run();
		expect(runServer).toHaveBeenCalledWith(defaultPort);
	});

	test('should override if prompt returns Yes, if there is files array', async () => {
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
				debug: false,
			},
		});

		importFiles.mockResolvedValueOnce({
			meshConfig,
		});

		await RunCommand.run();

		expect(runServer).toHaveBeenCalledWith(defaultPort);
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
				debug: false,
			},
		});

		promptConfirm.mockResolvedValueOnce(true);

		importFiles.mockResolvedValueOnce({
			meshConfig,
		});

		await RunCommand.run();
		expect(runServer).toHaveBeenCalledWith(defaultPort);
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

		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_subdirectory.json' },
			flags: {
				autoConfirmAction: Promise.resolve(true),
				debug: false,
			},
		});

		importFiles.mockResolvedValueOnce({
			meshConfig,
		});

		await RunCommand.run();

		expect(runServer).toHaveBeenCalledWith(defaultPort);
	});

	test('should fail if the file is outside the workspace directory', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_outside_workspace_dir.json' },
			flags: {
				debug: false,
				autoConfirmAction: Promise.resolve(false),
			},
		});

		const output = RunCommand.run();

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

		const output = RunCommand.run();

		await expect(output).rejects.toEqual(
			new Error(
				'Unable to import the files in the mesh config. Please check the file and try again.',
			),
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
		    "Unable to import the files in the mesh config. Please check the file and try again.",
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

		const output = RunCommand.run();

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

	test('should retrieve mesh artifact from sms if select flag is used', async () => {
		const parseOutput = {
			args: { file: 'src/commands/__fixtures__/sample_mesh.json' },
			flags: { port: 6000, debug: false, select: true },
		};

		parseSpy.mockResolvedValue(parseOutput);

		await RunCommand.run();

		expect(initSdk).toHaveBeenCalled();
		expect(getMeshId).toHaveBeenCalledWith(
			'mockOrgCode',
			'mockProjectId',
			'mockWorkspaceId',
			'mockWorkspaceTitle',
		);
		expect(getMeshArtifact).toHaveBeenCalledWith(
			'mockOrgCode',
			'mockProjectId',
			'mockWorkspaceId',
			'mockWorkspaceTitle',
			'mockMeshId',
		);
		expect(setUpTenantFiles).toHaveBeenCalled();
	});

	test('should return error for run command if mesh has placeholders and the provided secrets file is invalid', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_secrets_mesh.json' },
			flags: {
				secrets: 'src/commands/__fixtures__/secrets_invalid.yaml',
			},
		});

		const runResult = RunCommand.run();

		await expect(runResult).rejects.toEqual(
			new Error('Unable to import secrets. Please check the file and try again.'),
		);
	});

	test('should return error for run command if mesh has placeholders and the provided secrets file is not yaml or yml', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_secrets_mesh.json' },
			flags: {
				secrets: 'src/commands/__fixtures__/.secrets_file.env',
			},
		});

		const runResult = RunCommand.run();

		await expect(runResult).rejects.toEqual(
			new Error('Unable to import secrets. Please check the file and try again.'),
		);

		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Invalid file format. Please provide a YAML file (.yaml or .yml).",
		  ],
		]
	`);
	});

	test('should successfully run the mesh if provided secrets file is valid', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_secrets_mesh.json' },
			flags: {
				secrets: 'src/commands/__fixtures__/secrets_valid.yaml',
				debug: false,
			},
		});

		await RunCommand.run();
		expect(writeSecretsFile).toHaveBeenCalled();
		expect(runServer).toHaveBeenCalledWith(defaultPort);
	});

	test('should return error if ran with secrets against windows platform with batch variables', async () => {
		platformSpy.mockReturnValue('win32');
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_secrets_mesh.json' },
			flags: {
				secrets: 'src/commands/__fixtures__/secrets_with_batch_variables.yaml',
			},
		});

		const runResult = RunCommand.run();
		await expect(runResult).rejects.toEqual(
			new Error('Unable to import secrets. Please check the file and try again.'),
		);

		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Batch variables are not supported in YAML files on Windows.",
		  ],
		]
	`);
	});

	test('should pass if ran with secrets against linux platform with batch variables', async () => {
		platformSpy.mockReturnValue('linux');
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_secrets_mesh.json' },
			flags: {
				secrets: 'src/commands/__fixtures__/secrets_with_batch_variables.yaml',
				debug: false,
			},
		});

		await RunCommand.run();
		expect(writeSecretsFile).toHaveBeenCalled();
		expect(runServer).toHaveBeenCalledWith(defaultPort);
	});

	test('should pass if ran with secrets against darwin(macOS) platform with batch variables', async () => {
		platformSpy.mockReturnValue('darwin');
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_secrets_mesh.json' },
			flags: {
				secrets: 'src/commands/__fixtures__/secrets_with_batch_variables.yaml',
				debug: false,
			},
		});

		await RunCommand.run();
		expect(writeSecretsFile).toHaveBeenCalled();
		expect(runServer).toHaveBeenCalledWith(defaultPort);
	});

	test('should escape variables that are preceded by backslash symbol', async () => {
		parseSpy.mockResolvedValueOnce({
			args: { file: 'src/commands/__fixtures__/sample_mesh_with_escaped_secrets.json' },
			flags: {
				secrets: 'src/commands/__fixtures__/secrets_with_escaped_variables.yaml',
				debug: false,
			},
		});

		await RunCommand.run();
		expect(writeSecretsFile).toHaveBeenCalledWith(
			'Home: rootPath\nHomeString: $HOME\nHomeWithSlash: \\rootPath\nHomeStringWithSlash: \\$HOME\n',
			expect.anything(),
		);
		expect(runServer).toHaveBeenCalledWith(defaultPort);
	});
});
