function createPost({
  title, 
  domain, 
  timeAgo, 
  galleryCounter, 
  redditURL, 
  mediaURL, 
  posterURL,
  isVideo, 
  videoHeight, 
  over18 
}) {
  let postElem = document.createElement('div');

  postElem.innerHTML = `<div class="post ${over18 ? 'over18' : ''}">
    <div class="header">
      <a href="${redditURL}">${title}</a>
      <h1>${timeAgo} (<a href="${mediaURL}">${domain}</a>${galleryCounter})</h1>
    </div>
    <div class="media-container">
      ${isVideo 
        ? `<video data-src="${mediaURL}" poster="${posterURL}" height="${videoHeight}" preload="none" class="media" playsinline controls loop>`
        : `<img data-src="${mediaURL}" class="media">`
       }
    </div>
  </div>`;

  return postElem.firstChild;
}



// convert an array of JSON reddit post data into an array of post elements
function createPosts(children) {
  let newPosts = [];
  let openCount = 0;
  
  for (let i = 0; i < children.length; i++) {
    let postData = children[i].data;

    // load crosspost
    const crosspostParentList = postData.crosspost_parent_list;
    if (crosspostParentList && crosspostParentList.length > 0) {
      postData = crosspostParentList[0];
    }
    
    const title = postData.title;
    let domain = postData.domain;
    
    const timeAgo = timeAgoStr(new Date() - new Date(postData.created_utc * 1000));
    
    const redditURL = 'https://old.reddit.com' + postData.permalink;
    let mediaURL = postData.url;
    let posterURL = '';

    let isVideo = false;
    let videoHeight = 0;

    const over18 = postData.over_18;

    // reddit/imgur image
    if (domain === 'i.redd.it' || (domain === 'i.imgur.com' && mediaURL.slice(-5) !== '.gifv')) {
      // nothing to do here
    }
    // reddit gallery
    else if (domain === 'reddit.com') {
      const galleryData = postData.gallery_data;
      if (!galleryData || !galleryData.items) {
        console.warn(`Warning: gallery not found, skipping '${title}' - ${redditURL}\n`);
        continue;
      }

      const galleryItems = galleryData.items;
      const numItems = galleryItems.length;

      for (let j = 0; j < numItems; j++) {
        const item = galleryItems[j];
        const mediaID = item.media_id;

        const mimeType = postData.media_metadata[mediaID].m;
        if (!mimeType) {
          console.warn(`Warning: gallery post ${j+1}/${numItems}: image not found, skipping image in gallery '${title}' - ${redditURL}\n`);
          continue;
        }

        const ext = mimeType.split('/').pop();
        mediaURL = `https://i.redd.it/${mediaID}.${ext}`;

        const postElem = createPost({ 
          title: item.caption ? `${title}: ${item.caption}` : title,
          domain: domain,
          timeAgo: timeAgo,
          redditURL: redditURL,
          mediaURL: mediaURL,
          posterURL: '',
          isVideo: false,
          videoHeight: 0,
          galleryCounter: `, image ${j+1}/${numItems}`,
          over18: over18
        });
        newPosts.push(postElem);
      }
      openCount++;
      continue;
    }
    // reddit video
    else if (domain === 'v.redd.it') {
      const secureMedia = postData.secure_media;
      if (!secureMedia || !secureMedia.reddit_video) {
        console.warn(`Warning: video not found, skipping '${title}' - ${redditURL}\n`);
        continue;
      }
      const redditVideo = secureMedia.reddit_video;

      mediaURL = redditVideo.hls_url;
      if (!mediaURL) {
        console.warn(`Warning: HLS video URL not found, skipping '${title}' - ${redditURL}\n`);
        continue;
      }

      if (postData.preview && postData.preview.images && postData.preview.images[0].source) {
        posterURL = postData.preview.images[0].source.url;
      }

      mediaURL = mediaURL.split('?')[0];      // remove tracking
      isVideo = true;
      videoHeight = redditVideo.height;
    }
    // video fallback
    // optional chaining would be good here, but browser compatibility isn't great
    else if (
      postData.preview && 
      postData.preview.reddit_video_preview && 
      postData.preview.reddit_video_preview.hls_url
    ) {
      const redditVideoPreview = postData.preview.reddit_video_preview;

      mediaURL = redditVideoPreview.hls_url.split('?')[0];    // remove tracking
      posterURL = postData.preview.images[0].source.url;
      isVideo = true;
      videoHeight = redditVideoPreview.height;
      domain = new URL(mediaURL).hostname;
    }
    // image fallback
    else if (
      postData.preview && 
      postData.preview.images && 
      postData.preview.images[0] && 
      postData.preview.images[0].source && 
      postData.preview.images[0].source.url
    ) {
      mediaURL = postData.preview.images[0].source.url;
      domain = new URL(mediaURL).hostname;
    }
    else {
      console.warn(`Warning: invalid domain '${domain}', skipping '${title}' - ${redditURL}\n`);
      continue;
    }

    const postElem = createPost({ 
      title: title,
      domain: domain,
      timeAgo: timeAgo,
      redditURL: redditURL,
      mediaURL: mediaURL,
      posterURL: posterURL,
      isVideo: isVideo,
      videoHeight: videoHeight,
      galleryCounter: '',
      over18: over18
    });

    newPosts.push(postElem);
    openCount++;
  }
  console.log(`Opened ${openCount}/${children.length} posts`);

  return newPosts;
}



function timeAgoStr(delta) {
  const seconds = Math.floor(delta / 1000);

  if (seconds < 60) {
    return 'just now';
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return minutes > 1 ? minutes + ' minutes ago' : '1 minute ago';
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return hours > 1 ? hours + ' hours ago' : '1 hour ago';
  }

  const days = Math.floor(seconds / 86400);

  if (days < 30) {
    return days > 1 ? days + ' days ago' : '1 day ago';
  }
  if (days < 360) {
    const months = Math.floor(days / 30);
    return months > 1 ? months + ' months ago' : '1 month ago';
  }

  const years = Math.floor(days / 365);
  return years > 1 ? years + ' years ago' : '1 year ago';
}



function removePosts() {
  const video = document.querySelector('.active video');
  if (video !== null) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  document.querySelectorAll('.post').forEach(post => {
    post.querySelector('.media').removeAttribute('src');
    post.remove();
  });
}



document.addEventListener('DOMContentLoaded', function() {
  let p = 0;              // post index
  let maxIndex = -1;      // max post index
  let triggerIndex = 0;   // fetch new posts when this index is active
  let after = '';
  let nsfw = false;
  let url = '';

  const prevButton  = document.querySelector('.prev-button');
  const nextButton  = document.querySelector('.next-button');
  const counterElem = document.querySelector('.counter');
  const fetchSpinner = document.querySelector('.fetch-spinner');

  const homePage    = document.querySelector('.home');
  const closeButton = document.querySelector('.close-button');
  const homeArea    = document.querySelector('.home-area');
  const homeButton  = document.querySelector('.home-button');
  const errorElem   = document.querySelector('.home-error');

  const pastMenu    = document.querySelector('.past-menu');
  const inputElem   = document.querySelector('.subreddit-input');
  const inputButton = document.querySelector('.input-button');
  const inputSpinner = document.querySelector('.input-spinner');
  const inputArrow   = document.querySelector('.input-arrow');

  // check if HLS videos are supported
  if (!document.createElement('video').canPlayType('application/vnd.apple.mpegURL')) {
    errorElem.style.display = 'block';
    errorElem.innerHTML = 'Error: This browser is not officially supported. Please use Safari instead.';
  }


  function loadPost(i) {
    const posts = document.querySelectorAll('.post');

    if (i < 0 || i >= posts.length) {
      return;
    }

    // fetch new posts on trigger
    if (i === triggerIndex && after !== null) {
        fetchSpinner.classList.remove('hidden');
        fetch(url + '&after=' + after)
          .then(resp => resp.ok ? resp.json() : null)
          .then(json => {
              if (json === null) {
                return;
              }
              const nextPosts = createPosts(json['data']['children']);
              if (nextPosts.length === 0) {
                // no images/videos found, stop here
                after = null;
                return;
              }
              document.body.append(...nextPosts);

              after = json['data']['after'];
              triggerIndex = posts.length + Math.max(0, nextPosts.length - 5);

              nextButton.classList.remove('hidden');
              counterElem.textContent = p+1 + '/' + (posts.length + nextPosts.length);
          })
          .catch(err => console.error(err))
          .finally(() => fetchSpinner.classList.add('hidden'));
    }

    // remove current video from memory
    const video = posts[p].querySelector('video');
    if (video !== null) {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.removeAttribute('width');
    }

    posts[p].classList.remove('active');
    p = i;
    posts[p].classList.add('active');

    if (!nsfw) {
      if (posts[p].classList.contains('over18')) {
        document.body.classList.add('nsfw');
      } else {
        document.body.classList.remove('nsfw');
      }
    }

    // load next media
    const media = posts[p].querySelector('.media');
    media.src = media.getAttribute('data-src');

    if (media.localName === 'video') {
      // stop video controls from glitching 
      media.width = media.clientWidth;
    }

    // preload posts
    if (p > maxIndex) {
      maxIndex = p;

      for (let j = p+1; j < Math.min(posts.length, p+5); j++) {
        const media = posts[j].querySelector('.media');
        media.src = media.getAttribute('data-src');
      }
    }

    prevButton.classList.remove('hidden');
    nextButton.classList.remove('hidden');

    if (p === 0) {
      prevButton.classList.add('hidden');
    }
    if (p === posts.length-1) {
      nextButton.classList.add('hidden');
    }

    counterElem.textContent = p+1 + '/' + posts.length;
  }



  function prevPost() { loadPost(p-1) }
  function nextPost() { loadPost(p+1) }



  function search() {
    const pattern = /^[a-zA-Z0-9][a-zA-Z0-9_]{2,20}$/;
    let input = inputElem.value.trim();
    inputElem.blur();

    if (input.length === 0) {
      return;
    }
    if (!pattern.test(input)) {
      errorElem.style.display = 'block';
      errorElem.innerHTML = 'Error: Invalid subreddit name.';
      return;
    }

    inputSpinner.style.display = 'block';
    inputArrow.style.display = 'none';

    const initURL = `https://api.reddit.com/r/${input}/top.json?t=${pastMenu.value}&limit=25`;

    fetch(initURL)
      .then(resp => resp.ok ? resp.json() : Promise.reject(new Error()))
      .then(json => {
        const posts = createPosts(json['data']['children']);
        if (posts.length === 0) {
          throw new Error();
        }

        removePosts();
        document.body.append(...posts);

        // reset state
        p = 0;
        maxIndex = -1;
        triggerIndex = Math.max(0, posts.length - 5);
        after = json['data']['after'];
        url = initURL;

        homePage.style.display = 'none';
        closeButton.style.display = 'block';
        homeArea.style.display = 'block';
        errorElem.style.display = 'none';

        document.title = `rtop ${input} ${pastMenu.value !== 'all' ? 'past ' + pastMenu.value : 'all-time'}`;

        loadPost(0);
      })
      .catch(_ => {
        errorElem.style.display = 'block';
        if (!navigator.onLine) {
          errorElem.innerHTML = 'Error: Your internet connection appears to be offline. Please reconnect and try again.';
        } else {
          errorElem.innerHTML = 'Error: Unable to load subreddit data. Please try again or try a different subreddit.';
        }
      })
      .finally(() => {
        inputSpinner.style.display = 'none';
        inputArrow.style.display = 'block';
      });
  }

  // Event listeners

  window.addEventListener('keydown', (e) => {
    if (homePage.style.display === 'none') {
      if (e.keyCode === 37) {
        prevPost();
      } else if (e.keyCode === 39) { 
        nextPost();
      } else if (e.keyCode === 32 && !document.body.classList.contains('nsfw')) {
        const video = document.querySelector('.active video');
        if (video !== null) {
          video.paused ? video.play() : video.pause();
        }
      }
    }
  });

  prevButton.addEventListener('click', prevPost);
  nextButton.addEventListener('click', nextPost);

  closeButton.addEventListener('click', () => homePage.style.display = 'none');
  homeArea.addEventListener('click', () => homePage.style.display = 'none');
  homeButton.addEventListener('click', () => homePage.style.display = 'flex');

  inputElem.addEventListener('input', (e) => {
    if (e.target.value.length > 0) {
      inputButton.classList.add('blue-button');
    } else {
      inputButton.classList.remove('blue-button');
    }
  });

  inputElem.addEventListener('keydown', (e) => { if (e.keyCode === 13) search() });
  document.querySelector('.input-button').addEventListener('click', search);

  document.querySelector('.nsfw-banner button').addEventListener('click', () => {
    document.body.classList.remove('nsfw');
    nsfw = true;
  });
});
