

// Set the constants
console.log("Initialising extension");
var UPDATE_FREQUENCY = 5; // every 5 seconds
var INTERESTING_PAGE_MIN_TIMESPENT = 30; // seconds
var CAPTURE_UPDATE_INTERVAL = 24 * 60 * 60;  // we update the image preview every 24 hours
var SCHEMAS_VERSION = 1;

var DebugMode = false;

if (DebugMode)
{
  //localStorage.removeItem('Blacklist');
  //localStorage.removeItem('Whitelist');
  window.indexedDB.deleteDatabase('SmartHistory');
}

// Create the DBs and local storage
initialiseStorage();

if (DebugMode)
  refresh(); // Use refresh only if you want to debug. It's brutal otherwise.

setInterval(onTimer, UPDATE_FREQUENCY * 1000);

// Set Web Storage (localStorage) and IndexedDB
function initialiseStorage() 
{ 
  // localStorage
  initialiseOptions();
  initialiseBlackAndWhiteLists();
  
  // IndexedDB
  initDatabase();
}

// Options
function initialiseOptions() {
// debug
//  localStorage.removeItem("Options");

  if (!(localStorage["Options"])) {
    var opt = {}; // Add options
    localStorage["Options"] = JSON.stringify(opt);
    console.log("Options initialised");
  } else {
    return;
  }
}

// Blacklist
function initialiseBlackAndWhiteLists() {
// debug
//  localStorage.removeItem("Blacklist");
//  localStorage.removeItem("Whitelist");

  if (!(localStorage["Blacklist"])) {
    var arr = [];
    
    arr.push("\\w+.google.(?:com|fr)");
    arr.push("https://www.facebook.com");
    arr.push("https://twitter.com");
    
    localStorage["Blacklist"] = JSON.stringify(arr);
    console.log("Blacklist initialised");
  } else {
    return;
  }

  if (!(localStorage["Whitelist"])) {
    var arr = [];
    
    arr.push("https:\/\/fr.wikipedia.org");
    arr.push("https:\/\/docs.google.com");
    arr.push("https:\/\/scholar.google.fr");
    
    localStorage["Whitelist"] = JSON.stringify(arr);
    console.log("Whitelist initialised");
  } else {
    return;
  }  
}

function inBlacklist(url) 
{
  if (!localStorage["Blacklist"])
    return false;  

  // the URL should start with "http://" or "https://"
  if (!url.match(/^http/)) {
    return true;
  }
  var arr = JSON.parse(localStorage["Blacklist"]);
  for (var i = 0, l = arr.length; i < l; i++) {
    if (url.match(RegExp(arr[i]))) {
      return true;
    }
  }
  return false;
}

function inWhitelist(url) 
{
  if (!localStorage["Whitelist"])
    return false;

  var arr = JSON.parse(localStorage["Whitelist"]);
  for (var i = 0, l = arr.length; i < l; i++) {
    if (url.match(arr[i])) {
      return true;
    }
  }
  return false;
}

// Refresh all tabs when loading extension, in order to make sure that contentScript is loaded properly
function refresh() {
  console.log('Reloading all tabs.');
  
  chrome.windows.getAll(
    { populate: true },
    function(windows) {
      for (var i = 0, window; window = windows[i]; i++) {
        for (var j = 0, tab; tab = window.tabs[j]; j++) {
          tab.url.match(/^http/) && chrome.tabs.reload(
            tab.id,
            {
             // bypassCache: true    // Not sure why we should bypass the cache - commented in order to see if it changes anything
            } 
          );
        }
      }
    }
  );
}

// Initialise IndexedDB
function initDatabase() 
{
  var request = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
  request.onerror = function(event) 
  {
    console.log('Error while opening the database'); 
  };

  request.onsuccess = function(event)
  {
    console.log('Database ready');
  };
  
  request.onupgradeneeded = function(event) 
  {
    var db = event.target.result;
    createTables(db);
  };
}

function createTables(db)
{
  console.log('Preparing update...');

  // Indexes in object store 'URLs'
  var objectStore_URLs = db.createObjectStore('URLs', {keyPath: 'hash'});
  objectStore_URLs.createIndex('url', 'url', {unique: true});
  objectStore_URLs.createIndex('domain', 'domain', {unique: false});

  // Indexes in object store 'OpenGraph'
  var objectStore_OpenGraphData = db.createObjectStore('OpenGraph', {keyPath: 'hash'});

  // we keep a few indexed in order to be able to lookup pages using free text
  objectStore_OpenGraphData.createIndex('title', 'title', {unique: false});
  objectStore_OpenGraphData.createIndex('description', 'description', {unique: false});
  objectStore_OpenGraphData.createIndex('domain', 'domain', {unique: false});
  objectStore_OpenGraphData.createIndex('image_status', 'image_status', {unique: false});

  // Indexes in object store 'DailySessions'
  var objectStore_DailySessions = db.createObjectStore('DailySessions', {keyPath: ['hash', 'day']});
  objectStore_DailySessions.createIndex('day', 'day', {unique: false});
  objectStore_DailySessions.createIndex('hash', 'hash', {unique: false});
  objectStore_DailySessions.createIndex('domain', 'domain', {unique: false});

  console.log('Update finished!');
}

/*
 * Executed every UPDATE_FREQUENCY
 * 
 * In this function, we check the currently focused tab, and if it is not in the blacklist,
 * we increment the timespent on it
 */
function onTimer() 
{
  'use strict';

  chrome.windows.getLastFocused(
    function(window) {
      if (window === undefined || !window.focused)
      {
        // Now could be a good time to check if we need to compress some of the screen shots
        compressScreenShots();
        return;
      }

      var queryInfo = { active: true,
                        status: 'complete',
                        lastFocusedWindow: true};

      chrome.tabs.query(
        queryInfo,
        
        function(tabs) 
        {
          if (tabs[0] === undefined) {
            return;
          }

          // Check blacklist and whitelist
          if (!inWhitelist(tabs[0].url) &&
               inBlacklist(tabs[0].url)) {
            console.log(tabs[0].url + " is in the blacklist - ignoring");
            return;
          }

          // Ask the tab for its URL
          chrome.tabs.sendMessage(
            tabs[0].id,
            { message: 'GET_TAB_URL' },
            function(response) {
              if (response === undefined) {
                return;
              }

              // Check blacklist and whitelist again, because sometimes the canonical url looks different
              if (!inWhitelist(response.url) &&
                   inBlacklist(response.url)) {
                console.log(response.url + " is in the blacklist - ignoring");
                return;
              }

              var URLHash = updateURLTimeSpent(response.url, response.domain, tabs[0]);

              updateDailySession(URLHash, response.domain);
            }
          );
        }
      );
      
    }
  );
}

/**
 * Adds a URL to the IndexDB table URLs, and returns a hash. If the URLs already exists, adds 5 seconds to it
 * @param {[type]} url [description]
 * @param {[type]} tab [description]
 */
function updateURLTimeSpent(url, domain, tab)
{
  console.log('updateURLTimeSpent: ' + url);

  var hash = faultylabs.MD5(url);
  var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
  
  requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
  
  requestOpen.onsuccess = function(event) 
  {
    var db = event.target.result;  
    var objectStore = db.transaction(["URLs"], "readwrite").objectStore("URLs");
    var request = objectStore.get(hash);
    request.onerror = function(event) 
    {
      console.log("Error - can't get url in store: " + URL);
    };

    request.onsuccess = function(event) 
    {
      var data = event.target.result;
      
      if (!data)
        addNewURL(hash, url, domain);
      else
      {
        data.time_spent += UPDATE_FREQUENCY;
        data.last_access = Date();

        // If we have spent enough time on the page, let's grab the open graph data now:
        if (data.time_spent > INTERESTING_PAGE_MIN_TIMESPENT && !data.interesting_page)
        {
          // We spent quite some time on this URL, let's grab some more info
          console.log("Upgrading URL to interesting: " + url);
          data.interesting_page = true;
          addOpenGraphInfo(hash, tab);
        }

        // Put this updated object back into the database.
        var requestUpdate = objectStore.put(data);
        requestUpdate.onerror = function(event) {
          console.log("Error while updating URL: " + url);
        };
        requestUpdate.onsuccess = function(event) {
          console.log("URL updated: " + url + " - total time spent: " + data.time_spent);
        };        
      }
    };
  };

  return hash;
}

function addNewURL(hash, url, domain)
{
  var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
  
  requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
  
  requestOpen.onsuccess = function(event) 
  {
    var db = event.target.result;  
    var objectStore = db.transaction(["URLs"], "readwrite").objectStore("URLs");
    var obj = {
        'hash': hash,
        'url': url,
        'last_access': Date(),
        'time_spent': 0,
        'domain': domain,
        'creation_time': Date(),
        'interesting_page': false
      };

    // Build transaction
    objectStore.add(obj).onsuccess = function() {
      console.log("New URL added: " + url);
    };
  };
}

function addOpenGraphInfo(hash, tab)
{
  chrome.tabs.sendMessage(
      tab.id,
      { message: 'GET_TAB_OG_INFORMATION' },
      function(opengraphInfo)
      {
        console.log('Opengraph data acquired from tab');

        // Now that we have the Open Graph data, let's store it properly
        var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
        
        requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
        
        requestOpen.onsuccess = function(event) 
        {
          var db = event.target.result;  
          var objectStore = db.transaction(["OpenGraph"], "readwrite").objectStore("OpenGraph");

          if (opengraphInfo.image == "")
            opengraphInfo.image_status = 'needsScreenshot';
          else
            opengraphInfo.image_status = 'external_url';
            
          var og = {
            'hash': hash,
            'title': opengraphInfo.title,
            'domain': opengraphInfo.domain,
            'description': opengraphInfo.description,
            'update_time': Date(),
            'image': opengraphInfo.image,
            'image_status': opengraphInfo.image_status
          };

          console.log('Ready to store OpenGraph information');

          objectStore.add(og).onsuccess = function() {
            console.log('OpenGraph info stored in IndexedDB');
          };

          if (opengraphInfo.image_status == 'needsScreenshot')
            updateOpenGraphWithSceenshot(hash, tab);
        }
      }
    );
}


function updateOpenGraphWithSceenshot(hash, tab)
{
  // We seem to have no open graph image, so we grab a screenshot
  chrome.tabs.captureVisibleTab(
    tab.windowId,
    {format: "png"}, // Or "jpeg" + quality:80
    function(imgData) 
    {
      console.log('Screenshot captured');

      var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
      
      requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
      
      requestOpen.onsuccess = function(event) 
      {
        var db = event.target.result;  
        var objectStore = db.transaction(["OpenGraph"], "readwrite").objectStore("OpenGraph");
        var request = objectStore.get(hash);
        request.onerror = function(event) 
        {
          console.log("Can't update open graph data with screenshot, no record found: " + hash);
        };

        request.onsuccess = function(event) 
        {
          var opengraphInfo = event.target.result;
          
          opengraphInfo.screenshot_date = Date();
          opengraphInfo.image = imgData;
          opengraphInfo.image_status = 'needsResizing'; // we'll need to resize the image later

          // Put this updated object back into the database.
          var requestUpdate = objectStore.put(opengraphInfo);
          requestUpdate.onerror = function(event) {
            console.log("Error while updating open graph with screenshot: " + hash);
          };
          requestUpdate.onsuccess = function(event) {
            console.log("Screenshot updated");
          };
        };
      };
    }
  );
}

function updateDailySession(hash, domain)
{
  console.log('updateDailySession: ' + hash);

  var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
  
  requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
  
  requestOpen.onsuccess = function(event) 
  {
    var today = (new Date()).toLocaleDateString();

    var db = event.target.result;  
    var objectStore = db.transaction(["DailySessions"], "readwrite").objectStore("DailySessions");
    var request = objectStore.get([hash, today]);

    request.onerror = function(event) 
    {
      console.log("Error while getting daily session");
    };

    request.onsuccess = function(event) 
    {
      var data = event.target.result;
      
      if (!data)
        addNewDailySession(hash, domain, today)
      else
      {
        data = event.target.result;
        data.daily_time_spent += UPDATE_FREQUENCY;

        // Put this updated object back into the database.
        var requestUpdate = objectStore.put(data);
        requestUpdate.onerror = function(event) {
          console.log("Error while updating daily session");
        };
        requestUpdate.onsuccess = function(event) {
          console.log("Daily session updated");
        };
      }
    };
  };
}

function addNewDailySession(hash, domain, today)
{
  console.log('addNewDailySession: ' + hash);

  var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
  
  requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
  
  requestOpen.onsuccess = function(event) 
  {
    var db = event.target.result;  
    var objectStore = db.transaction(["DailySessions"], "readwrite").objectStore("DailySessions");

    var obj = {
      'hash': hash,
      'day': today,
      'domain': domain,
      'daily_time_spent': 0
    }

    // Build transaction
    objectStore.add(obj).onsuccess = function() {
      console.log("New daily session added: ");
    };
  };
}

/**
 * Find all OpenGraph objects where a raw screenshot has been taken
 * and needs resizing in order to save bytes, and compress them
 */
function compressScreenShots()
{
  var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
  
  requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
  
  requestOpen.onsuccess = function(event) 
  {
    var db = event.target.result;  

    var objectStore = db.transaction(['OpenGraph'], 'readwrite').objectStore('OpenGraph');
    var requestImages = objectStore.index('image_status').openCursor('needsResizing');
    requestImages.onsuccess = function()
    {
      var cursor = requestImages.result;
      if (cursor)
      {
        console.log("Resizing thumbnail for: " + cursor.value.title + ", current image size: " + cursor.value.image.length);
        resizeImage(cursor.value.image, 240, 188, cursor.value.hash);
        cursor.continue();
      }
    };
  };
}

// 240, 188
function resizeImage(url, maxWidth, maxHeight, hash) 
{
    var sourceImage = new Image();

    sourceImage.onload = function() 
    {
      var ratio = 0;  // Used for aspect ratio
      var width = sourceImage.width;    // Current image width
      var height = sourceImage.height;  // Current image height

      // Check if the current width is larger than the max
      if (width > maxWidth)
      {
          ratio = maxWidth / width;   // get ratio for scaling image
          height = height * ratio;    // Reset height to match scaled image
          width = width * ratio;    // Reset width to match scaled image
      }

      // Check if current height is larger than max
      if (height > maxHeight)
      {
          ratio = maxHeight / height; // get ratio for scaling image
          width = width * ratio;    // Reset width to match scaled image
          height = height * ratio;    // Reset height to match scaled image
      }

      // Create a canvas with the desired dimensions
      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      // Scale and draw the source image to the canvas
      canvas.getContext("2d").drawImage(sourceImage, 0, 0, width, height);

      // Convert the canvas to a data URL in PNG format
      saveResizedImage(hash, canvas.toDataURL());
    }

    sourceImage.src = url;
}

function saveResizedImage(hash, resizedImage)
{
  var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
  
  requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
  
  requestOpen.onsuccess = function(event) 
  {
    var db = event.target.result;  
    var objectStore = db.transaction(["OpenGraph"], "readwrite").objectStore("OpenGraph");
    var request = objectStore.get(hash);

    request.onerror = function(event) 
    {
      console.log("Error while getting open graph session");
    };

    request.onsuccess = function(event) 
    {
      var data = event.target.result;
              
      data.image = resizedImage;
      data.image_status = 'resized'; // we'll need to resize the image later

      // Put this updated object back into the database.
      var requestUpdate = objectStore.put(data);
      requestUpdate.onerror = function(event) {
        console.log("Error while updating open graph");
      };
      requestUpdate.onsuccess = function(event) {
        console.log("Open graph updated with resized image");
      };
    };
  };
}

// ----- utility functions for the popup and the more page



var deletePageFromURLs = function(hash) 
{
  var dfd = $.Deferred();
  setTimeout(function() 
  {
    var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
    
    requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
    
    requestOpen.onsuccess = function(event)
    {
      var db = event.target.result;
      var objectStoreURLs = db.transaction(['URLs'], 'readwrite').objectStore('URLs');

      objectStoreURLs.get(hash).onsuccess = function(event) 
      {
        // Fixme: the url here might be the canonical url that might look differently from the page's url (ex. Pole-emploi where they use shorten URLs)
        addToBlacklist(event.target.result.url);
        objectStoreURLs.delete(hash).onsuccess = function() {
          console.log('An object has been removed from \'URLs\' object store!');
          dfd.resolve();
        };
      };
    };
  }, 0);
  return dfd;promise();
};

var deletePageFromOpenGraphData = function(hash) 
{
  var dfd = $.Deferred();
  setTimeout(function() {
    var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
    
    requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
  
    requestOpen.onsuccess = function(event) {
      // Open IDB and a transaction
      var db = event.target.result;
      var requestDelete = db.transaction(['OpenGraph'], 'readwrite').objectStore('OpenGraph').delete(hash);
      requestDelete.onsuccess = function() {
        console.log('Hash properly removed from open graph data');
        dfd.resolve();
      };
    }
  }, 0);
  return dfd.promise();
};

var deletePageFromDailySessions = function(hash)
{
  var dfd = $.Deferred();
  setTimeout(function() 
  {
    var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
  
    requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
  
    requestOpen.onsuccess = function(event) {
      var db = event.target.result;
      var objectStoreTimes = db.transaction('DailySessions', 'readwrite').objectStore('DailySessions');
      var requestDailySessions = objectStoreTimes.index('hash').openKeyCursor(hash);
      
      requestDailySessions.onsuccess = function() 
      {
        var cursor = requestDailySessions.result;
        if (cursor) 
        {
          objectStoreTimes.delete(cursor.primaryKey);
          cursor.continue();
        }
        else
        {
          console.log('Hash properly removed from DailySessions');
          dfd.resolve();
        }
      }
    };
  }, 0);
  return dfd.promise();
};

// Remove domain
var removeDomain = function(domain) 
{
  addToBlacklist(domain);
  var dfd = $.Deferred();
  setTimeout(function()
  {
    var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
  
    requestOpen.onerror = function(event) { console.log('Error while opening the database'); };

    requestOpen.onsuccess = function(event) 
    {
      var db = event.target.result;

      // delete in 'URLs' object store
      var objectStoreURLs = db.transaction('URLs', 'readwrite').objectStore('URLs');
      var requestURLs = objectStoreURLs.index('domain').openKeyCursor(domain);
      requestURLs.onsuccess = function()
      {
        var cursor = requestURLs.result;
        if (cursor) {
          objectStoreURLs.delete(cursor.primaryKey); // Then delete the value
          cursor.continue();
        }
      };

      var objectStoreOpenGraphs = db.transaction('OpenGraph', 'readwrite').objectStore('OpenGraph');
      var requestOGs = objectStoreOpenGraphs.index('domain').openKeyCursor(domain);
      requestOGs.onsuccess = function()
      {
        var cursor = requestOGs.result;
        if (cursor) {
          objectStoreOpenGraphs.delete(cursor.primaryKey); // Then delete the value
          cursor.continue();
        }
      };

      var objectStoreDailySessions = db.transaction('DailySessions', 'readwrite').objectStore('DailySessions');
      var requestDSs = objectStoreDailySessions.index('domain').openKeyCursor(domain);
      requestDSs.onsuccess = function()
      {
        var cursor = requestDSs.result;
        if (cursor) {
          objectStoreDailySessions.delete(cursor.primaryKey); // Then delete the value
          cursor.continue();
        }
      };
    };
  }, 0);
  return dfd.promise(); // Return deferred object's promise
};

var addToBlacklist = function(str)
{
  var arr = Array();
  if (localStorage["Blacklist"])
    arr = JSON.parse(localStorage['Blacklist']);

  arr.unshift(str);
  localStorage['Blacklist'] = JSON.stringify(arr);
};

var addShare = function(sn, shareLink) {
  $('.' + sn).each(function(i, obj) {
    var url = $(obj).attr('url');
    $(obj).on('click', function() {
      window.open(shareLink + url, '', 'scrollbars=yes, width=630, height=560');
    });
  });
};




