$('.upload-btn').on('click', function () {
  $('#upload-input').click();
  $('.progress-bar').text('0%');
  $('.progress-bar').width('0%');
});

$('#upload-input').on('change', function () {

  var files = $(this).get(0).files;

  if (files.length > 0) {
    var formData = new FormData();
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      formData.append('uploads[]', file, file.name);
    }

    $.ajax({
      url: recognitionServerUrl + '/api/recognizeFile',
      type: 'POST',
      data: formData,
      crossDomain: true,
      processData: false,
      contentType: false,
      success: function (data) {
        console.log('upload successful!\n' + data);
        var baseUrl = '/app/#/search/'
        var sorting = '/relevance/';
        var query = '"' + data.replace(/,/g, '" OR "') + '"';
        var url = baseUrl + encodeURIComponent(query) + sorting;
        /*
        // Search using a filter
        var tags = data.split(',');
        var query = '';
        for(var i=0; i<tags.length; i++) {
          if (i>0) {
            query += '&';
          }
          query += 'tags[' + i + ']=' + tags[i];
        }
        var url = baseUrl + sorting + encodeURIComponent(query);*/
        console.log(url);
        parent.window.location.href = url;
      },
      xhr: function () {
        // create an XMLHttpRequest
        var xhr = new XMLHttpRequest();

        // listen to the 'progress' event
        xhr.upload.addEventListener('progress', function (evt) {

          if (evt.lengthComputable) {
            // calculate the percentage of upload completed
            var percentComplete = evt.loaded / evt.total;
            percentComplete = parseInt(percentComplete * 100);

            // update the Bootstrap progress bar with the new percentage
            $('.progress-bar').text(percentComplete + '%');
            $('.progress-bar').width(percentComplete + '%');

            console.debug('Upload progress: ' + percentComplete);

            // once the upload reaches 100%, set the progress bar text to done
            if (percentComplete === 100) {
              $('.panel-upload').css('display', 'none');
              $('.panel-search').css('display', 'block');
            }
          }
        }, false);
        return xhr;
      }
    });

  }
});
