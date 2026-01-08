const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

const API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const SITE_ID = process.env.WEBFLOW_SITE_ID;

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
    
    const html = fs.readFileSync('index.html', 'utf8');
    const $ = cheerio.load(html);
    
    const collections = await getCollections();
    console.log('📦 Collections found:', collections.map(c => c.displayName).join(', '));
    
    const postsCollection = collections.find(c => 
      c.displayName.toLowerCase().includes('blog') || 
      c.displayName.toLowerCase().includes('post')
    );
    const gradesCollection = collections.find(c => c.displayName.toLowerCase().includes('grade'));
    const topicsCollection = collections.find(c => 
      c.displayName.toLowerCase().includes('topic') && 
      c.id !== postsCollection?.id
    );
    
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
          <div role="listitem" class="collection-item-5 w-dyn-item w-col w-col-6" 
               data-grade="${field.grade || ''}" 
               data-topic="${field.topics || ''}" 
               data-title="${(field.name || '').toLowerCase()}" 
               data-description="${(field.description || field.summary || '').toLowerCase()}">
            <div class="topic-card">
              <a href="/posts/${field.slug || '#'}" class="link-block-9 w-inline-block">
                <img loading="lazy" src="${field['main-image']?.url || 'https://d3e54v103j8qbb.cloudfront.net/plugins/Basic/assets/placeholder.60f9b1840c.svg'}" alt="${field.name || ''}" class="image-5">
                <div class="text-block-10">${field.topics || ''}</div>
                <div class="div-block-24">
                  <div class="grade-label">Grade</div>
                  <div class="grade-text">${field.grade || ''}</div>
                </div>
                <h3 class="heading-8">${field.name || ''}</h3>
              </a>
              <p class="paragraph">${field.description || field.summary || ''}</p>
              <a href="/posts/${field.slug || '#'}" class="main-post-btn w-button">Read More</a>
            </div>
          </div>
        `;
        postsList.append(postHTML);
      });
      
      $('.cms-list').siblings('.w-dyn-empty').remove();
    }
    
    // Inject Grades Filter
    if (grades.length > 0) {
      const gradesList = $('.grades-collection-list');
      gradesList.empty();
      
      grades.forEach((grade, index) => {
        const field = grade.fieldData;
        const gradeHTML = `
          <div role="listitem" class="w-dyn-item">
            <label class="radio-button-field-3 w-radio">
              <input type="radio" name="grade-filter" class="w-form-formradioinput radio-button-2 w-radio-input grade-radio" value="${field.name}" data-filter-type="grade">
              <span class="radio-grades w-form-label">${field.name}</span>
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
      
      topics.forEach((topic, index) => {
        const field = topic.fieldData;
        const topicHTML = `
          <div role="listitem" class="w-dyn-item">
            <label class="radio-button-field-2 w-radio">
              <input type="radio" name="topic-filter" class="w-form-formradioinput radio-button w-radio-input topic-radio" value="${field.name}" data-filter-type="topic">
              <span class="radio-list w-form-label">${field.name}</span>
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
    
    // Add custom filtering JavaScript
    console.log('📚 Adding custom filter script...');
    
    const filterScript = `
    <script>
    (function() {
      let selectedGrade = '';
      let selectedTopic = '';
      let searchQuery = '';
      
      function filterPosts() {
        const posts = document.querySelectorAll('.collection-item-5');
        let visibleCount = 0;
        
        posts.forEach(post => {
          const grade = post.dataset.grade || '';
          const topic = post.dataset.topic || '';
          const title = post.dataset.title || '';
          const description = post.dataset.description || '';
          const searchText = title + ' ' + description;
          
          let showPost = true;
          
          // Filter by grade
          if (selectedGrade && grade !== selectedGrade) {
            showPost = false;
          }
          
          // Filter by topic
          if (selectedTopic && topic !== selectedTopic) {
            showPost = false;
          }
          
          // Filter by search
          if (searchQuery && !searchText.includes(searchQuery.toLowerCase())) {
            showPost = false;
          }
          
          if (showPost) {
            post.style.display = '';
            visibleCount++;
          } else {
            post.style.display = 'none';
          }
        });
        
        // Update counts
        document.querySelector('[fs-cmsfilter-element="results-count"]').textContent = visibleCount;
        
        // Show/hide empty state
        const emptyState = document.querySelector('[fs-cmsfilter-element="empty"]');
        if (emptyState) {
          emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
        }
        
        // Scroll to results
        setTimeout(() => {
          const results = document.getElementById('resultsList');
          if (results) {
            const y = results.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
          }
        }, 100);
      }
      
      // Grade filter
      document.querySelectorAll('.grade-radio').forEach(radio => {
        radio.addEventListener('change', function() {
          selectedGrade = this.value;
          filterPosts();
        });
      });
      
      // Topic filter
      document.querySelectorAll('.topic-radio').forEach(radio => {
        radio.addEventListener('change', function() {
          selectedTopic = this.value;
          filterPosts();
        });
      });
      
      // Search filter
      const searchInput = document.querySelector('.search-bar');
      if (searchInput) {
        searchInput.addEventListener('input', function() {
          searchQuery = this.value;
          filterPosts();
        });
      }
      
      // Clear button
      const clearBtn = document.querySelector('[fs-cmsfilter-element="clear"]');
      if (clearBtn) {
        clearBtn.addEventListener('click', function(e) {
          e.preventDefault();
          selectedGrade = '';
          selectedTopic = '';
          searchQuery = '';
          
          // Uncheck all radios
          document.querySelectorAll('.grade-radio, .topic-radio').forEach(r => r.checked = false);
          
          // Clear search input
          if (searchInput) searchInput.value = '';
          
          filterPosts();
        });
      }
    })();
    </script>
    `;
    
    $('body').append(filterScript);
    
    // Create dist directory
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
    
    // Save HTML
    fs.writeFileSync('dist/index.html', $.html());
    
    console.log('✅ Build completed successfully!');
    console.log(`📄 Generated: dist/index.html`);
    console.log(`🔍 Custom filters enabled`);
    
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

buildSite();
