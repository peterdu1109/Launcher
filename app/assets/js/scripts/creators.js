const encodedClientID = 'dDdxeWh6aXMzNnAxOHk0eWkxeW05anV3cjZmN25h';
const encodedClientSecret = 'cmFtaXVidXJtMmZqZGF2ZzNrN2hrYWV0aXNzbHZ6';

const CLIENT_ID = Buffer.from(encodedClientID, 'base64').toString('utf-8');
const CLIENT_SECRET = Buffer.from(encodedClientSecret, 'base64').toString('utf-8');

let OAUTH_TOKEN = null;
let TOKEN_EXPIRATION = 0;

async function fetchNewToken() {
    try {
        const response = await fetch('https://id.twitch.tv/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'client_credentials',
            }),
        });

        if (!response.ok) throw new Error(`Error fetching token: ${response.statusText}`);

        const data = await response.json();
        OAUTH_TOKEN = data.access_token;
        TOKEN_EXPIRATION = Date.now() + data.expires_in * 1000;
    } catch (error) {
        console.error('Token renewal error:', error);
    }
}

async function ensureValidToken() {
    if (!OAUTH_TOKEN || Date.now() > TOKEN_EXPIRATION) {
        await fetchNewToken();
    }
}

async function fetchFromTwitch(endpoint) {
    await ensureValidToken();
    try {
        const response = await fetch(endpoint, {
            headers: {
                'Client-ID': CLIENT_ID,
                'Authorization': `Bearer ${OAUTH_TOKEN}`,
            },
        });

        if (!response.ok) throw new Error(`Twitch API error: ${response.status}`);

        return await response.json();
    } catch (error) {
        console.error('Error fetching data from Twitch:', error);
        return null;
    }
}

async function checkTwitchStreamStatus(username) {
    const data = await fetchFromTwitch(`https://api.twitch.tv/helix/streams?user_login=${username}`);
    return data?.data?.length > 0 ? 'live' : 'offline';
}

async function getTwitchStreamerImage(username) {
    const data = await fetchFromTwitch(`https://api.twitch.tv/helix/users?login=${username}`);
    return data?.data?.[0]?.profile_image_url || null;
}

async function loadCreatorsData() {
    try {
        const creatorsContainer = document.getElementById('creators-container');
        if (!creatorsContainer) return;

        creatorsContainer.innerHTML = '';

        const serverData = await fetchCreatorsData();
        if (!serverData?.servers || serverData.servers.length === 0) {
            creatorsContainer.innerHTML = `
                <div class="empty-message">
                    <i class="fa-solid fa-users-slash"></i> <span>${Lang.queryEJS('status.noCreators')}</span>
                </div>`;
            addCloseButton(creatorsContainer);
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const server of serverData.servers) {
            const creatorContent = document.createElement('div');
            creatorContent.classList.add('creatorContent');

            const serverTitle = document.createElement('div');
            serverTitle.classList.add('creator-title');
            serverTitle.innerText = `Streamers ${server.name}`;
            creatorContent.appendChild(serverTitle);

            const creatorList = document.createElement('div');
            creatorList.classList.add('creator-list');

            if (server.creators.length > 0) {
                const creatorsData = await Promise.all(
                    server.creators.map(async (creator) => {
                        const username = creator.channel.split('/')[3];
                        const [image, status] = await Promise.all([  
                            creator.platform === 'Twitch' ? getTwitchStreamerImage(username) : null,
                            creator.platform === 'Twitch' ? checkTwitchStreamStatus(username) : 'offline',
                        ]);
                        return { ...creator, image, status };
                    })
                );

                creatorsData.sort((a, b) => (b.status === 'live') - (a.status === 'live'));

                creatorsData.forEach((creator) => {
                    const creatorItem = createCreatorItem(creator, creator.image, creator.status);
                    creatorList.appendChild(creatorItem);
                });
            }

            creatorContent.appendChild(creatorList);
            fragment.appendChild(creatorContent);
        }

        creatorsContainer.appendChild(fragment);

        addScrollListener();
        addCloseButton(creatorsContainer);
    } catch (error) {
        console.error('Error loading creator data:', error);
    }
}

function addCloseButton(container) {
    if (!document.getElementById('creators-close')) {
        const closeButton = document.createElement('button');
        closeButton.id = 'creators-close';
        closeButton.classList.add('Creators-closebtn');
        closeButton.innerText = Lang.queryEJS('status.confirm');
        closeButton.onclick = () => {
            switchView(getCurrentView(), VIEWS.landing);
        };

        container.appendChild(closeButton);
    }
}

async function fetchCreatorsData() {
    try {
        const response = await fetch(`https://hastastudios.com.br/creators.json?nocache=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`Error loading JSON: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error loading server data:', error);
        return null;
    }
}

function createCreatorItem(creator, image, status) {
    const creatorItem = document.createElement('div');
    creatorItem.classList.add('creator-item');
    if (status === 'live') creatorItem.classList.add('online-opacity');
    if (image) {
        creatorItem.style.backgroundImage = `url(${image})`;
        creatorItem.classList.add('with-bg');
    }

    const creatorNameContainer = document.createElement('div');
    creatorNameContainer.classList.add('creator-name-container');

    const creatorStatusCircle = document.createElement('div');
    creatorStatusCircle.classList.add('status-circle', status === 'live' ? 'live' : 'offline');
    creatorNameContainer.appendChild(creatorStatusCircle);

    const creatorName = document.createElement('div');
    creatorName.classList.add('creator-name');
    creatorName.innerText = creator.name;
    creatorNameContainer.appendChild(creatorName);

    creatorItem.appendChild(creatorNameContainer);

    const visitButton = document.createElement('button');
    visitButton.classList.add('visit-button');
    visitButton.innerText = Lang.queryEJS('status.viewChannel');
    visitButton.onclick = () => {
        const { shell } = require('electron');
        shell.openExternal(creator.channel);
    };
    creatorItem.appendChild(visitButton);

    return creatorItem;
}

function creatorsScrollListener(e) {
    const target = e.target;
    const scrollThreshold = 5;
    if (target.scrollTop > scrollThreshold) {
        target.setAttribute('scrolled', '');
    } else {
        target.removeAttribute('scrolled');
    }
}

function addScrollListener() {
    const creatorsContainer = document.getElementById('creators-container');
    if (creatorsContainer) {
        creatorsContainer.addEventListener('scroll', creatorsScrollListener);
    }
}

function disablePageScroll() {
    document.body.style.overflow = 'hidden';
}

function enablePageScroll() {
    document.body.style.overflow = '';
}

async function updateLiveStatus() {
    const serverData = await fetchCreatorsData();
    if (!serverData?.servers) return;

    let algumCriadorEmLive = false;
    for (const server of serverData.servers) {
        for (const creator of server.creators) {
            if (creator.platform === 'Twitch') {
                const username = creator.channel.split('/')[3];
                const status = await checkTwitchStreamStatus(username);
                if (status === 'live') {
                    algumCriadorEmLive = true;
                    break;
                }
            }
        }
        if (algumCriadorEmLive) break;
    }

    const creatorsMediaButton = document.getElementById('CreatorsMediaButton');
    if (creatorsMediaButton) {
        if (algumCriadorEmLive) {
            creatorsMediaButton.classList.add('live');
        } else {
            creatorsMediaButton.classList.remove('live');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadCreatorsData();
    disablePageScroll();
    updateLiveStatus();
});
