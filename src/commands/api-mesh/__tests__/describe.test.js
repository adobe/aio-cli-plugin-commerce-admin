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

jest.mock('axios');
jest.mock('@adobe/aio-lib-env');
jest.mock('@adobe/aio-lib-ims');
jest.mock('../../../helpers', () => ({
	initSdk: jest.fn().mockResolvedValue({}),
	initRequestId: jest.fn().mockResolvedValue({}),
}));
jest.mock('@adobe/aio-cli-lib-console', () => ({
	init: jest.fn().mockResolvedValue(mockConsoleCLIInstance),
	cleanStdOut: jest.fn(),
}));
jest.mock('../../../lib/devConsole');
jest.mock('chalk', () => ({
	bold: jest.fn(text => text), // Return the input text without any color formatting
	underline: {
		blue: jest.fn(text => text),
	},
	bgYellow: jest.fn(text => text),
}));

const DescribeCommand = require('../describe');
const { initSdk, initRequestId } = require('../../../helpers');
const { describeMesh, getMesh, getTenantFeatures } = require('../../../lib/devConsole');
const sampleCreateMeshConfig = require('../../__fixtures__/sample_mesh.json');

const selectedOrg = { id: '1234', code: 'CODE1234@AdobeOrg', name: 'ORG01', type: 'entp' };
const selectedProject = { id: '5678', title: 'Project01' };
const selectedWorkspace = { id: '123456789', title: 'Workspace01' };

let logSpy = null;
let errorLogSpy = null;
let parseSpy = null;

const mockIgnoreCacheFlag = jest.fn().mockResolvedValue(true);

describe('describe command tests', () => {
	beforeEach(() => {
		initSdk.mockResolvedValue({
			imsOrgId: selectedOrg.id,
			imsOrgCode: selectedOrg.code,
			projectId: selectedProject.id,
			workspaceId: selectedWorkspace.id,
			workspaceName: selectedWorkspace.title,
		});

		describeMesh.mockResolvedValue({
			meshId: 'dummy_meshId',
			apiKey: 'dummy_apiKey',
		});

		getMesh.mockResolvedValue({
			meshId: 'dummy_id',
			meshURL: '',
		});

		getTenantFeatures.mockResolvedValue({
			imsOrgId: selectedOrg.code,
			showCloudflareURL: false,
		});

		global.requestId = 'dummy_request_id';

		logSpy = jest.spyOn(DescribeCommand.prototype, 'log');
		errorLogSpy = jest.spyOn(DescribeCommand.prototype, 'error');
		parseSpy = jest.spyOn(DescribeCommand.prototype, 'parse');
		parseSpy.mockResolvedValue({
			flags: {
				ignoreCache: mockIgnoreCacheFlag,
			},
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	test('snapshot describe command description', () => {
		expect(DescribeCommand.description).toMatchInlineSnapshot(`"Get details of a mesh"`);
		expect(DescribeCommand.args).toMatchInlineSnapshot(`undefined`);
		expect(DescribeCommand.flags).toMatchInlineSnapshot(`
		{
		  "ignoreCache": {
		    "allowNo": false,
		    "char": "i",
		    "default": false,
		    "description": "Ignore cache and force manual org -> project -> workspace selection",
		    "parse": [Function],
		    "type": "boolean",
		  },
		}
	`);
		expect(DescribeCommand.aliases).toMatchInlineSnapshot(`[]`);
	});

	test('should error if describe api has failed', async () => {
		describeMesh.mockRejectedValueOnce(new Error('Describe api failed'));

		const runResult = DescribeCommand.run();

		await expect(runResult).rejects.toEqual(
			new Error(
				'Describe api failed Please check the details and try again. If the error persists please contact support. RequestId: dummy_request_id',
			),
		);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Describe api failed Please check the details and try again. If the error persists please contact support. RequestId: dummy_request_id",
		  ],
		]
	`);
	});

	test('should error if mesh details is missing from describe api response', async () => {
		describeMesh.mockResolvedValueOnce(null);

		const runResult = DescribeCommand.run();

		await expect(runResult).rejects.toEqual(
			new Error(
				'Unable to get mesh details. Please check the details and try again. If the error persists please contact support. RequestId: dummy_request_id',
			),
		);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Unable to get mesh details. Please check the details and try again. If the error persists please contact support. RequestId: dummy_request_id",
		  ],
		]
	`);
	});

	test('should error if mesh id is missing from describe api response', async () => {
		describeMesh.mockResolvedValueOnce({});
		await DescribeCommand.run().catch(err => {
			expect(err.message).toContain(
				'Unable to get mesh details. Please check the details and try again.',
			);
		});
	});

	test('should not fail if api key is missing from mesh details', async () => {
		describeMesh.mockResolvedValueOnce({ meshId: 'dummy_meshId' });

		const runResult = await DescribeCommand.run();

		expect(runResult).toMatchInlineSnapshot(`
		{
		  "imsOrgId": "1234",
		  "meshId": "dummy_meshId",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_meshId/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Successfully retrieved mesh details 
		",
		  ],
		  [
		    "Org ID: %s",
		    "1234",
		  ],
		  [
		    "Project ID: %s",
		    "5678",
		  ],
		  [
		    "Workspace ID: %s",
		    "123456789",
		  ],
		  [
		    "Mesh ID: %s",
		    "dummy_meshId",
		  ],
		  [
		    "Mesh Endpoint: %s",
		    "https://edge-sandbox-graph.adobe.io/api/dummy_meshId/graphql",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`[]`);
	});

	test('should return Non TI url if request is Non Ti', async () => {
		const runResult = await DescribeCommand.run();

		expect(initRequestId).toHaveBeenCalled();
		expect(describeMesh).toHaveBeenCalledWith(
			selectedOrg.code,
			selectedProject.id,
			selectedWorkspace.id,
			selectedWorkspace.title,
		);
		expect(runResult).toMatchInlineSnapshot(`
		{
		  "apiKey": "dummy_apiKey",
		  "imsOrgId": "1234",
		  "meshId": "dummy_meshId",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_meshId/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Successfully retrieved mesh details 
		",
		  ],
		  [
		    "Org ID: %s",
		    "1234",
		  ],
		  [
		    "Project ID: %s",
		    "5678",
		  ],
		  [
		    "Workspace ID: %s",
		    "123456789",
		  ],
		  [
		    "Mesh ID: %s",
		    "dummy_meshId",
		  ],
		  [
		    "Mesh Endpoint: %s",
		    "https://edge-sandbox-graph.adobe.io/api/dummy_meshId/graphql",
		  ],
		]
	`);
	});

	test('should return Ti URL if api return TI url', async () => {
		let fetchedMeshConfig = sampleCreateMeshConfig;
		fetchedMeshConfig.meshId = 'dummy_id';
		fetchedMeshConfig.meshURL = 'https://tigraph.adobe.io';

		getMesh.mockResolvedValue(fetchedMeshConfig);
		const runResult = await DescribeCommand.run();

		expect(initRequestId).toHaveBeenCalled();
		expect(describeMesh).toHaveBeenCalledWith(
			selectedOrg.code,
			selectedProject.id,
			selectedWorkspace.id,
			selectedWorkspace.title,
		);
		expect(runResult).toMatchInlineSnapshot(`
		{
		  "apiKey": "dummy_apiKey",
		  "imsOrgId": "1234",
		  "meshId": "dummy_meshId",
		  "meshUrl": "https://edge-sandbox-graph.adobe.io/api/dummy_meshId/graphql",
		  "projectId": "5678",
		  "workspaceId": "123456789",
		  "workspaceName": "Workspace01",
		}
	`);
		expect(logSpy.mock.calls).toMatchInlineSnapshot(`
		[
		  [
		    "Successfully retrieved mesh details 
		",
		  ],
		  [
		    "Org ID: %s",
		    "1234",
		  ],
		  [
		    "Project ID: %s",
		    "5678",
		  ],
		  [
		    "Workspace ID: %s",
		    "123456789",
		  ],
		  [
		    "Mesh ID: %s",
		    "dummy_meshId",
		  ],
		  [
		    "Mesh Endpoint: %s",
		    "https://edge-sandbox-graph.adobe.io/api/dummy_meshId/graphql",
		  ],
		]
	`);
		expect(errorLogSpy.mock.calls).toMatchInlineSnapshot(`[]`);
	});

	test('should show prod edge mesh url on workspace named "Production" if feature is enabled', async () => {
		// mock the edge mesh url feature to be enabled
		getTenantFeatures.mockResolvedValueOnce({
			imsOrgId: selectedOrg.code,
			showCloudflareURL: true,
		});

		// mock the workspace name to "Production"
		initSdk.mockResolvedValueOnce({
			workspaceName: 'Production',
		});

		await DescribeCommand.run();

		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining('Mesh Endpoint:'),
			'https://edge-graph.adobe.io/api/dummy_meshId/graphql',
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

		await DescribeCommand.run();

		expect(logSpy).toHaveBeenCalledWith(
			expect.stringContaining('Mesh Endpoint:'),
			'https://edge-sandbox-graph.adobe.io/api/dummy_meshId/graphql',
		);
	});
});
