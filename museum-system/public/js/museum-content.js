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

      document.querySelectorAll('[data-museum-list]').forEach(element => {
        renderTextLines(element, museumInfo[element.dataset.museumList], 'li');
      });

      document.title = document.title.replace('Museo Sang Bata sa Negros', museumInfo.name || '');
    } catch (error) {
      console.error('Museum content load error:', error);
      document.querySelectorAll('[data-museum-field], [data-museum-template], [data-museum-paragraphs], [data-museum-list]')
        .forEach(element => { element.textContent = 'Museum information is currently unavailable.'; });
    }
  }

  loadMuseumContent();
})();
