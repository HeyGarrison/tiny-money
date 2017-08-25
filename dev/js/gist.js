import _ from 'lodash';

const github_key = 'github-api-key-abc123';
const github_doc = 'gist-doc-id-abc123';

export function gistPatch($Vue, callback) {
  const hidden = JSON.stringify($Vue.hidden);
  
  localStorage.setItem('HIDDEN', hidden);
  
  $Vue.$http.patch(`https://api.github.com/gists/${github_doc}`, {
    files: {
      'localStorage.json': {
        content: hidden
      }
    }
  }, {
    headers: {
      Authorization: `token ${github_key}`
    },
    before: (request) => {
      if ($Vue.previousPatch)
        $Vue.previousPatch.abort();

      $Vue.previousPatch = request;
    }
  })
    .then(() => {

      if (callback)
        callback();
    })
    .catch((err) => {
      console.error(err);
    });
}

export function gistGet($Vue, callback) {
  $Vue.$http.get(`https://api.github.com/gists/${github_doc}`, {
    headers: {
      Authorization: `token ${github_key}`
    },
    before: (request) => {
      if ($Vue.previousGet)
        $Vue.previousGet.abort();

      $Vue.previousGet = request;
    }
  })
    .then((res) => {
      $Vue.hidden = _.uniq(JSON.parse(res.data.files['localStorage.json'].content));
      localStorage.setItem('HIDDEN', JSON.stringify($Vue.hidden));

      if (callback)
        callback();
    })
    .catch((err) => {
      console.error(err);
    });
}