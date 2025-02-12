const StatusCommand = require('../status');

// Initialize mock values
const mockOrg = { id: '1234', code: 'CODE1234@AdobeOrg', name: 'ORG01', type: 'entp' };
const mockProject = { id: '5678', title: 'Project01' };
const mockWorkspace = { id: '123456789', title: 'Workspace01' };
const mockMeshId = '00000000-0000-0000-0000-000000000000';
global.requestId = 'dummy_request_id';

// Create mock modules and functions
jest.mock('../../../lib/devConsole');
jest.mock('../../../helpers');
const parseSpy = jest.spyOn(StatusCommand.prototype, 'parse');
const logSpy = jest.spyOn(StatusCommand.prototype, 'log');
const errorLogSpy = jest.spyOn(StatusCommand.prototype, 'error');

// Prepare mocks
const { initSdk } = require('../../../helpers');
const { getMeshId, getMesh, getMeshDeployments } = require('../../../lib/devConsole');
initSdk.mockResolvedValue({
	imsOrgId: mockOrg.id,
	imsOrgCode: mockOrg.code,
	projectId: mockProject.id,
	workspaceId: mockWorkspace.id,
	workspaceName: mockWorkspace.title,
	orgName: mockOrg.name,
	projectName: mockProject.title,
});
parseSpy.mockResolvedValue({
	flags: {},
});

describe('status command tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		getMeshId.mockResolvedValue(mockMeshId);
		getMesh.mockResolvedValue({ meshStatus: null });
	});

	describe('use mesh build status', () => {
		test.each([
			['pending', 'Mesh is awaiting processing.'],
			['building', 'Mesh is currently building. Wait a few minutes before checking again.'],
			['error', 'Mesh build has errors.'],
			['not-a-real-status', 'Mesh status is not available. Wait a few minutes and try again.'],
			[null, 'Mesh status is not available. Wait a few minutes and try again.'],
		])(
			'should output correct message when mesh build status is "%s"',
			async (meshBuildStatus, expectedMessage) => {
				getMesh.mockResolvedValue({ meshStatus: meshBuildStatus });
				await StatusCommand.run();
				expect(logSpy).toHaveBeenCalledWith(expectedMessage);
			},
		);
	});

	describe('use mesh deployment status', () => {
		beforeEach(() => {
			getMesh.mockResolvedValue({ meshStatus: 'success' });
			getMeshDeployments.mockResolvedValue({
				status: null,
				meshId: mockMeshId,
				error: null,
			});
		});

		test.each([
			['provisioning', 'Currently provisioning your mesh. Wait a few minutes and try again.'],
			['de-provisioning', 'Currently de-provisioning your mesh. Wait a few minutes and try again.'],
			['success', 'Mesh was provisioned successfully.'],
			['error', 'Mesh provisioning has errors.'],
			['not-a-real-status', 'Mesh status is not available. Wait a few minutes and try again.'],
			[null, 'Mesh status is not available. Wait a few minutes and try again.'],
		])(
			'should output correct message when mesh deployment status is "%s"',
			async (meshDeployStatus, expectedMessage) => {
				getMeshDeployments.mockResolvedValue({
					status: meshDeployStatus,
					meshId: mockMeshId,
					error: null,
				});
				await StatusCommand.run();
				expect(logSpy).toHaveBeenCalledWith(expectedMessage);
			},
		);
	});

	describe('unexpected error', () => {
		test('should output mesh not found error when mesh does not exist', async () => {
			getMeshId.mockResolvedValue(null);
			const expectedMessage = `Unable to get mesh status. No mesh found for Org(${mockOrg.id}) -> Project(${mockProject.id}) -> Workspace(${mockWorkspace.id}). Please check the details and try again.`;
			const runResult = StatusCommand.run();
			await expect(runResult).rejects.toEqual(new Error(expectedMessage));
			expect(errorLogSpy).toHaveBeenCalledWith(expectedMessage);
		});
	});
});
