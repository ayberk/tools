const feedUrlInput = document.getElementById('feed-url');
const fetchBtn = document.getElementById('fetch-btn');
const feedContainer = document.getElementById('feed-container');
const errorMessage = document.getElementById('error-message');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const pageInfo = document.getElementById('page-info');
const paginationContainer = document.getElementById('pagination');

const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json?rss_url=';

let allItems = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 6;

function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
    feedContainer.innerHTML = '';
    paginationContainer.classList.add('hidden');
}

function clearError() {
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function sanitizeHTML(str) {
	// profound minimalist approach: strip html tags for preview
	const temp = document.createElement('div');
	temp.innerHTML = str;
	return temp.textContent || temp.innerText || '';
}

async function fetchFeed() {
    const url = feedUrlInput.value.trim();
    if (!url) {
        showError('Please enter a URL.');
        return;
    }

    clearError();
    feedContainer.innerHTML = '<div style="text-align:center; color: var(--text-secondary);">Loading...</div>';
    paginationContainer.classList.add('hidden');

    try {
        const response = await fetch(`${RSS2JSON_API}${encodeURIComponent(url)}`);
        const data = await response.json();

        if (data.status === 'ok') {
            allItems = data.items;
            currentPage = 1;
            renderPage();
            updatePaginationControls();
            paginationContainer.classList.remove('hidden');
        } else {
            showError('Failed to load feed. Check the URL and try again.');
        }
    } catch (err) {
        showError('An error occurred while fetching the feed.');
        console.error(err);
    }
}

function renderPage() {
    feedContainer.innerHTML = '';

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const itemsToRender = allItems.slice(start, end);

    itemsToRender.forEach(item => {
        const card = document.createElement('a');
        card.href = item.link;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.className = 'feed-item';

        const pubDate = formatDate(item.pubDate);
        const snippet = sanitizeHTML(item.description).substring(0, 200) + '...';

        let innerHTML = `
            <div class="item-meta">
                <span>${pubDate}</span>
                ${item.author ? `<span>•</span><span>${item.author}</span>` : ''}
            </div>
            <h2 class="item-title">${item.title}</h2>
            <p class="item-snippet">${snippet}</p>
        `;

        // Basic image extraction if available in thumbnail or description
        // This is a naive simplistic approach fitting a minimalist reader
        if (item.thumbnail) {
             innerHTML = `<img src="${item.thumbnail}" alt="" loading="lazy">` + innerHTML;
        }

        card.innerHTML = innerHTML;
        feedContainer.appendChild(card);
    });

    // Scroll to top of feed container on page change
    if (currentPage > 1) {
        document.querySelector('.input-group').scrollIntoView({ behavior: 'smooth' });
    }
}

function updatePaginationControls() {
    const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);

    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages || totalPages === 0;
}

prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderPage();
        updatePaginationControls();
    }
});

nextBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
        currentPage++;
        renderPage();
        updatePaginationControls();
    }
});

fetchBtn.addEventListener('click', fetchFeed);
feedUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        fetchFeed();
    }
});
