/*
 * popup page of SmartHistory
 *
 */

var FB_SHARE_LINK = 'https://www.facebook.com/sharer/sharer.php?u=';
var TW_SHARE_LINK = 'https://twitter.com/intent/tweet?url=';
var YM_SHARE_LINK = 'https://www.yammer.com/home/bookmarklet?bookmarklet_pop=1&u=';

document.addEventListener("DOMContentLoaded", function(event) {
  /*
   * Retrieve data from IDB
   */
  var objContainer = [];
  
  // View model of knockout.js
  var ViewModel = function(arr) {
    this.itemsArr = ko.observableArray(arr);
  };
  
  var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
  requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
  requestOpen.onsuccess = function(event) {
    var db = event.target.result;
    var objectStoreImages = db.transaction(['OpenGraph']).objectStore('OpenGraph');
    objectStoreImages.openCursor().onsuccess = function(event) {
      var cursor = event.target.result;
      if (cursor) {
        // Retrieve data from 'Images' object store
        var objModel = {
          hash: cursor.key,
          title: cursor.value.title,
          description: cursor.value.description,
          image: cursor.value.image
        };
        // Retrieve data from 'URLs' object store
        var objectStoreURLs = db.transaction(['URLs']).objectStore('URLs');
        objectStoreURLs.get(cursor.value.hash).onsuccess = function(event) {
          var objURLs = event.target.result;
          if (objURLs === undefined) {
            return;
          } else {
            objModel.url = objURLs.url
            objModel.domain = objURLs.domain;
            objModel.last_access = (new Date(objURLs.last_access)).toLocaleString();
            objModel.last_access_date = new Date(objURLs.last_access);
            
            objContainer.push(objModel);
          }
        }
        cursor.continue();
      } else {
        // Sort interesting pages by last access time
        objContainer.sort(function(a, b) {
          return Date.parse(b.last_access_date) - Date.parse(a.last_access_date);
        });


        // Take the first 3 elements out and pass them to ViewModel
        ko.applyBindings(new ViewModel(objContainer.slice(0, 3)));
        
        // Functionality of 'remove' button
        // By URL
        $('.removePage').each(function(i, obj) {
          $(obj).on('click', function() {
            var cfm = confirm('Do you want to delete this page?');
            if (!cfm) {
              return;
            } else {
              var hash = $(this).attr('data-hash');
              $.when(
                deletePageFromURLs(hash),
                deletePageFromDailySessions(hash),
                deletePageFromOpenGraphData(hash)
              ).then(function() {
                location.reload();
              });
            }
          });
        });
        
        // By domain
        $('.removeDomain').each(function(i, obj) {
          $(obj).on('click', function() {
            var cfm = confirm('Do you want to delete this domain?');
            if (!cfm) {
              return;
            } else {
              var domain = $(this).attr('data-domain');
              $.when(
                removeDomain(domain)
              ).then(function() {
                location.reload();
              });
            }
          });
        });
        
        // Functionality of 'share' button
        addShare('fb', FB_SHARE_LINK);
        addShare('tw', TW_SHARE_LINK);
        addShare('ym', YM_SHARE_LINK);
      }
    };
  };
  // Functionality of 'more' button
  document.getElementById("more").onclick = more;
  document.getElementById("options").onclick = options;
});

var more = function() {
  chrome.windows.getLastFocused(
    function(window) {
      var createProperties = {
        windowId: window.id,
        url: "../more/more.html"
      };
      chrome.tabs.create(createProperties);
    }
  );
}

var options = function() {
  chrome.windows.getLastFocused(
    function(window) {
      var createProperties = {
        windowId: window.id,
        url: "../opt/options.html"
      };
      chrome.tabs.create(createProperties);
    }
  );
}

//// Maybe useful later
//function secToTime(sec) {
//  var days = parseInt(sec / (3600 * 24));
//  var hours = parseInt(sec / 3600) % 24;
//  var minutes = parseInt(sec / 60) % 60;
//  var seconds = sec % 60;
//  var time = '';
//  if (sec > (3600*24)) {
//    time += days + 'd ';
//  }
//  if (sec > 3600) {
//    time += (hours < 10 ? '0' + hours : hours) + 'h ';
//  }
//  if (sec > 60) {
//    time += (minutes < 10 ? '0' + minutes : minutes) + 'm ';
//  }
//  time += (seconds < 10 ? '0' + seconds : seconds) + 's';
//  return time;
//}

/*
var remove = function(hash) {
  var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
  requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
  requestOpen.onsuccess = function(event) {
    // Open IDB and a transaction
    var db = event.target.result;
    var transaction = db.transaction(['URLs', 'Images', 'Times'], 'readwrite');
    // 'URLs' object stroe
    var requestURLs = transaction.objectStore('URLs').delete(hash);
    requestURLs.onsuccess = function() {
      console.log('An object has been removed from \'URLs\' object store!');
    };
    // 'Images' object store
    var requestImages = transaction.objectStore('Images').delete(hash);
    requestImages.onsuccess = function() {
      console.log('An object has been removed from \'Images\' object store!');
    };
    // 'Times' object store
    var objectStoreTimes = db.transaction('Times', 'readwrite').objectStore('Times');
    var requestTimes = objectStoreTimes.index('hash').openKeyCursor(hash);
    requestTimes.onsuccess = function() {
      var cursor = requestTimes.result;
      if (cursor) {
        console.log(cursor);
        console.log(cursor.primaryKey);
        objectStoreTimes.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        console.log('Some objects have been removed from \'Times\' object store!');
      }
    }
  }
}
*/



//var removeADomainInTimes = function(hash) {
//  var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
//  requestOpen.onsuccess = function(event) {
//    var db = event.target.result;
//    var objectStoreTimes = db.transaction('Times', 'readwrite').objectStore('Times');
//    var requestTimes = objectStoreTimes.index('hash').openKeyCursor(hash);
//    requestTimes.onsuccess = function(event) {
//      var cursor = event.target.result;
//      if (cursor) {
//        objectStoreTimes.delete(cursor.primaryKey);
//        cursor.continue();
//      } else {
//        console.log('Deleted objects with a same hash in Times !');
//      }
//    }
//  }
//}


/*
var removeDomainInImages = function(domain) {
  var deferredObject = $.Deferred();
  setTimeout(function() {
    var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
    requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
    requestOpen.onsuccess = function(event) {
      var hashContainer = [];
      var db = event.target.result;
      var objectStoreURLs = db.transaction('URLs', 'readwrite').objectStore('URLs');
      var requestURLs = objectStoreURLs.index('domain').openKeyCursor(domain);
      requestURLs.onsuccess = function() {
        var cursor = requestURLs.result;
        if (cursor) {
          hashContainer.push(cursor.primaryKey);
          cursor.continue();
        } else {
          var numOfFinished = 0;
          var objectStoreImages = db.transaction('Images', 'readwrite').objectStore('Images');
          for (var i = 0, l = hashContainer.length; i < l; i++) {
            objectStoreImages.delete(hashContainer[i]).onsuccess = function() {
              console.log('Un object has been removed from \'Images\' object store!');
              if (++numOfFinished === l) {
                deferredObject.resolve();
              }
            };
          }
        }
      };
    };
  }, 0);
  return deferredObject.promise();
}
*/


//var removeDomainInTimes = function() {
//  // jQuery.Deferred()
//  var dfd = $.Deferred();
//  setTimeout(function() {
//    var requestOpen = window.indexedDB.open('SmartHistory', SCHEMAS_VERSION);
//    requestOpen.onerror = function(event) { console.log('Error while opening the database'); };
//    requestOpen.onsuccess = function(event) {
//      var db = event.target.result;
//      var objectStoreURLs = db.transaction('URLs', 'readwrite').objectStore('URLs');
//      var requestURLs = objectStoreURLs.index('domain').openKeyCursor(domain);
//      requestURLs.onsuccess = function() {
//        var container = [];
//        var cursor = requestURLs.result;
//        if (cursor) {
//          container.push(cursor.primaryKey);
//          cursor.continue();
//        } else {
//          var objectStoreTimes = db.transaction('Times', 'readwrite').objectStore('Times');
//          for (key in container) {
//            var requestTimes = objectStoreTimes.index('hash').openKeyCursor(key);
//            requestTimes.onsuccess = function() {
//              var cursor = requestTimes.result;
//              if (cursor) {
//                objectStoreTimes.delete(cursor.primaryKey);
//                cursor.continue();
//              } else {
//                console.log('Some objects have been removed from \'Times\' object store!');
//              }
//            }
//          }
//          dfd.resolve();
//        }
//      };
//    };
//  }, 0);
//  return dfd.promise();
//}

























