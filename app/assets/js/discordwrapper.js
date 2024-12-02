const { LoggerUtil } = require('hasta-core');
const { Client } = require('discord-rpc-patch');
const Lang = require('./langloader');

const logger = LoggerUtil.getLogger('DiscordWrapper');

let client;
let activity;

exports.initRPC = function(genSettings, servSettings, initialDetails = Lang.queryJS('discord.waiting')) {
    const clientId = servSettings.clientId || genSettings.clientId;
    if (!clientId) {
        logger.error('Client ID não definido. Não foi possível iniciar o Discord RPC.');
        return;
    }

    client = new Client({ transport: 'ipc' });

    activity = {
        details: initialDetails,
        state: Lang.queryJS('discord.state', { shortId: servSettings.shortId }),
        largeImageKey: servSettings.largeImageKey,
        largeImageText: servSettings.largeImageText,
        smallImageKey: genSettings.smallImageKey,
        smallImageText: genSettings.smallImageText,
        startTimestamp: new Date().getTime(),
        instance: false,
        buttons: [
            { label: 'Website', url: 'https://hastastudios.com.br' }, // Botão para o website
            { label: 'Entrar no Discord', url: servSettings.discordInvite }, // Botão para o Discord do servidor
        ],
    };

    client.on('ready', () => {
        logger.info(`Discord RPC conectado com o Client ID: ${clientId}`);
        client.setActivity(activity);
    });

    client.login({ clientId }).catch((error) => {
        if (error.message.includes('ENOENT')) {
            logger.info('Unable to initialize Discord Rich Presence, no client detected.');
        } else {
            logger.info('Unable to initialize Discord Rich Presence: ' + error.message, error);
        }
    });
};

exports.updateDetails = function(details) {
    if (!client) {
        logger.warn('Não é possível atualizar os detalhes, o RPC ainda não foi inicializado.');
        return;
    }
    activity.details = details;
    client.setActivity(activity);
};

exports.shutdownRPC = function() {
    if (!client) return;
    client.clearActivity();
    client.destroy();
    client = null;
    activity = null;
};
