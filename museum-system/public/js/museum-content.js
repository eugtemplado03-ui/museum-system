// Fill page-specific museum information fields and text lists from the shared API.
(function () {
  // Replace a container with non-empty text entries, hiding it when no entries remain.
  function renderTextLines(container, value, tagName) {
    const values = Array.isArray(value) ? value : String(value || '').split(/\r?\n/);
    container.replaceChildren();
    values.map(item => String(item).trim()).filter(Boolean).forEach(text => {
      const element = document.createElement(tagName);
      element.textContent = text;
      container.appendChild(element);
    });
    if (!container.childElementCount) container.hidden = true;
  }

  // Render fee groups as headings with bulleted prices while keeping their source text dynamic.
  function renderRateSections(container, value) {
    const lines = (Array.isArray(value) ? value : String(value || '').split(/\r?\n/))
      .map(item => String(item).trim())
      .filter(Boolean);
    container.replaceChildren();

    let currentList = null;
    lines.forEach(line => {
      const sectionMatch = line.match(/^(.+?):\s*(.*)$/);
      const startsWithRate = sectionMatch && /^(?:PHP|₱)\s*[\d,.]+/i.test(sectionMatch[2]);
      const bundledRates = sectionMatch && sectionMatch[2]
        ? sectionMatch[2].split(/,\s*(?=(?:PHP|₱)\s*[\d,.]+)/i).map(rate => rate.trim()).filter(Boolean)
        : [];

      if (sectionMatch && (!sectionMatch[2] || startsWithRate)) {
        const heading = document.createElement('h3');
        heading.className = 'rates-subtitle';
        heading.textContent = sectionMatch[1].trim();
        container.appendChild(heading);
        currentList = document.createElement('ul');
        currentList.className = 'rates-list';
        container.appendChild(currentList);
        bundledRates.forEach(rate => {
          const item = document.createElement('li');
          item.textContent = rate;
          currentList.appendChild(item);
        });
        return;
      }

      if (!currentList) {
        currentList = document.createElement('ul');
        currentList.className = 'rates-list';
        container.appendChild(currentList);
      }

      const item = document.createElement('li');
      item.textContent = line;
      currentList.appendChild(item);
    });

    container.hidden = lines.length === 0;
  }

  // Populate data-bound page fields and lists from the museum-info endpoint.
  async function loadMuseumContent() {
    try {
      const response = await fetch('/api/museum-info');
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const { museumInfo } = await response.json();
      if (!museumInfo) throw new Error('Museum information is missing from the response');

      document.querySelectorAll('[data-museum-field]').forEach(element => {
        const value = museumInfo[element.dataset.museumField];
        element.textContent = value || '';
        if (!value) element.hidden = true;
      });

      document.querySelectorAll('[data-museum-template]').forEach(element => {
        element.textContent = element.dataset.museumTemplate.replace('{name}', museumInfo.name || '');
      });

      document.querySelectorAll('[data-museum-paragraphs]').forEach(element => {
        renderTextLines(element, museumInfo[element.dataset.museumParagraphs], 'p');
      });

      document.querySelectorAll('[data-museum-rates]').forEach(element => {
        renderRateSections(element, museumInfo[element.dataset.museumRates]);
      });

      document.querySelectorAll('[data-museum-list]').forEach(element => {
        renderTextLines(element, museumInfo[element.dataset.museumList], 'li');
      });

      document.title = document.title.replace('Museo Sang Bata sa Negros', museumInfo.name || '');
    } catch (error) {
      console.error('Museum content load error:', error);
      document.querySelectorAll('[data-museum-field], [data-museum-template], [data-museum-paragraphs], [data-museum-list], [data-museum-rates]')
        .forEach(element => { element.textContent = 'Museum information is currently unavailable.'; });
    }
  }

  loadMuseumContent();
})();
