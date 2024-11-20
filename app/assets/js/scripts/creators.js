require('dotenv').config({ override: true });

const CLIENT_ID = process.env.CLIENT_ID;
const OAUTH_TOKEN = process.env.OAUTH_TOKEN;
console.log('CLIENT_ID:', process.env.CLIENT_ID);
console.log('OAUTH_TOKEN:', process.env.OAUTH_TOKEN);

async function fetchFromTwitch(endpoint) {
    try {
        const response = await fetch(endpoint, {
            headers: {
                'Client-ID': CLIENT_ID,
                'Authorization': `Bearer ${OAUTH_TOKEN}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Error with Twitch response: ${response.status}`);
        }

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
        if (!creatorsContainer) {
            throw new Error('Element #creators-container not found in DOM.');
        }

        creatorsContainer.innerHTML = '';

        const serverData = await fetchCreatorsData();

        if (!serverData.servers || serverData.servers.length === 0) {
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
        const response = await fetch('https://hastastudios.com.br/creators.json');

        if (!response.ok) {
            throw new Error(`Error loading JSON: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error loading server data:', error);
        return null;
    }
}

function createCreatorItem(creator, image, status) {
    const creatorItem = document.createElement('div');
    creatorItem.classList.add('creator-item');

    if (status === 'live') {
        creatorItem.classList.add('online-opacity');
    }

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

/*function addEscKeyListener() {
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            switchView(getCurrentView(), VIEWS.landing);
        }
    });
}

 */
document.addEventListener('DOMContentLoaded', () => {
    loadCreatorsData();
    disablePageScroll();
    // addEscKeyListener();
});
