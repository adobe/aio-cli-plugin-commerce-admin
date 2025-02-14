const { getCliEnv } = require('@adobe/aio-lib-env');

const clientEnv = getCliEnv();

const StageConstants = {
	DEV_CONSOLE_BASE_URL: 'https://developers-stage.adobe.io/console',
	DEV_CONSOLE_API_KEY: 'adobe-api-manager-sms-stage',
	DEV_CONSOLE_TRANSPORTER_API_KEY: 'UDPWeb1',
	AIO_CLI_API_KEY: 'aio-cli-console-auth-stage',
	SMS_BASE_URL: 'https://graph-stage.adobe.io/api-admin',
	MESH_BASE_URL: 'https://edge-stage-graph.adobe.io/api',
	SMS_API_KEY: 'adobe-graph-stage-onboarding',
};

const ProdConstants = {
	DEV_CONSOLE_BASE_URL: 'https://developers.adobe.io/console',
	DEV_CONSOLE_API_KEY: 'adobe-graph-prod',
	DEV_CONSOLE_TRANSPORTER_API_KEY: 'UDPWeb1',
	AIO_CLI_API_KEY: 'aio-cli-console-auth',
	SMS_BASE_URL: 'https://graph.adobe.io/api-admin',
	MESH_BASE_URL: 'https://edge-graph.adobe.io/api',
	MESH_SANDBOX_BASE_URL: 'https://edge-sandbox-graph.adobe.io/api',
	SMS_API_KEY: 'adobe-graph-prod',
};

const envConstants = clientEnv === 'stage' ? StageConstants : ProdConstants;
module.exports = { ...envConstants };
