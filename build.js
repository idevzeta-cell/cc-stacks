const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

const API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const SITE_ID = process.env.WEBFLOW_SITE_ID;

// Fetch all collections for a site
async function getCollections() {
  const response = await fetch(
    `https://api.webflow.com/v2/sites/${SITE_ID}/collections`,
    {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'accept-version': '1.0.0'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch collections: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.collections;
}

// Fetch items from a collection
async function fetchCollectionItems(collectionId) {
  const response = await fetch(
    `https://api.webflow.com/v2/collections/${collectionId}/items`,
    {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'accept-version': '1.0.0'
      }
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch items: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.items;
}

async function buildSite() {
  try {
    console.log('🚀 Starting build process...');
    
    // Read the HTML file
    const html = fs.readFileSync('index.html', 'utf8');
    const $ = cheerio.load(html);
    
    // Get all collections
    const collections = await getCollections();
    console.log('📦 Collections found:', collections.map(c => c.displayName).join(', '));
    
    // Find specific collections by name (adjust these names to match your Webflow collections)
    const postsCollection = collections.find(c => c.displayName.toLowerCase().includes('post') || c.displayName.toLowerCase().includes('topic'));
    const gradesCollection = collections.find(c => c.displayName.toLowerCase().includes('grade'));
    const topicsCollection = collections.find(c => c.displayName.toLowerCase().includes('topic') && c.displayName.toLowerCase() !== postsCollection?.displayName.toLowerCase());
    
    // Fetch all items
    const posts = postsCollection ? await fetchCollectionItems(postsCollection.id) : [];
    const grades = gradesCollection ? await fetchCollectionItems(gradesCollection.id) : [];
    const topics = topicsCollection ? await fetchCollectionItems(topicsCollection.id) : [];
    
    console.log(`📝 Fetched ${posts.length} posts`);
    console.log(`📊 Fetched ${grades.length} grades`);
    console.log(`🏷️  Fetched ${topics.length} topics`);
    
    // Inject Main Posts
    if (posts.length > 0) {
      const postsList = $('.cms-list');
      postsList.empty();
      
      posts.forEach(post => {
        const field = post.fieldData;
        const postHTML = `
          <div role="listitem" class="collection-item-5 w-dyn-item w-col w-col-6">
            <div class="topic-card">
              <a href="/posts/${field.slug || '#'}" class="link-block-9 w-inline-block">
                <img loading="lazy" src="${field['main-image']?.url || 'https://d3e54v103j8qbb.cloudfront.net/plugins/Basic/assets/placeholder.60f9b1840c.svg'}" alt="${field.name || ''}" class="image-5">
                <div fs-cmsfilter-field="Topics" class="text-block-10">${field.topics || ''}</div>
                <div class="div-block-24">
                  <div fs-cmsfilter-field="Grades" class="grade-label">Grade</div>
                  <div fs-cmsfilter-field="Grade" class="grade-text">${field.grade || ''}</div>
                </div>
                <h3 fs-cmsfilter-field="" class="heading-8">${field.name || ''}</h3>
              </a>
              <p fs-cmsfilter-field="" class="paragraph">${field.description || field.summary || ''}</p>
              <a href="/posts/${field.slug || '#'}" class="main-post-btn w-button">Read More</a>
            </div>
          </div>
        `;
        postsList.append(postHTML);
      });
      
      // Remove "No items found" message
      $('.cms-list').siblings('.w-dyn-empty').remove();
    }
    
    // Inject Grades Filter
    if (grades.length > 0) {
      const gradesList = $('.grades-collection-list');
      gradesList.empty();
      
      grades.forEach(grade => {
        const field = grade.fieldData;
        const gradeHTML = `
          <div role="listitem" class="w-dyn-item">
            <label class="radio-button-field-3 w-radio">
              <input type="radio" name="radio-2" id="grade-${grade.id}" data-name="Radio 2" class="w-form-formradioinput radio-button-2 w-radio-input" value="${field.name}">
              <span fs-cmsfilter-field="Grade" class="radio-grades w-form-label" for="grade-${grade.id}">${field.name}</span>
            </label>
          </div>
        `;
        gradesList.append(gradeHTML);
      });
      
      gradesList.siblings('.w-dyn-empty').remove();
    }
    
    // Inject Topics Filter
    if (topics.length > 0) {
      const topicsList = $('.topics-collection-list');
      topicsList.empty();
      
      topics.forEach(topic => {
        const field = topic.fieldData;
        const topicHTML = `
          <div role="listitem" class="w-dyn-item">
            <label class="radio-button-field-2 w-radio">
              <input type="radio" name="radio" id="topic-${topic.id}" data-name="Radio" class="w-form-formradioinput radio-button w-radio-input" value="${field.name}">
              <span fs-cmsfilter-field="Topics" class="radio-list w-form-label" for="topic-${topic.id}">${field.name}</span>
            </label>
          </div>
        `;
        topicsList.append(topicHTML);
      });
      
      topicsList.siblings('.w-dyn-empty').remove();
    }
    
    // Update counts
    $('[fs-cmsfilter-element="items-count"]').text(posts.length);
    $('[fs-cmsfilter-element="results-count"]').text(posts.length);
    
    // Create dist directory if it doesn't exist
    if (!fs.existsSync('dist')) {
      fs.mkdirSync('dist', { recursive: true });
    }
    
    // Copy assets
    if (fs.existsSync('images')) {
      fs.cpSync('images', 'dist/images', { recursive: true });
    }
    if (fs.existsSync('js')) {
      fs.cpSync('js', 'dist/js', { recursive: true });
    }
    if (fs.existsSync('css')) {
      fs.cpSync('css', 'dist/css', { recursive: true });
    }
    
    // Save the updated HTML
    fs.writeFileSync('dist/index.html', $.html());
    
    console.log('✅ Build completed successfully!');
    console.log(`📄 Generated: dist/index.html`);
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

buildSite();
