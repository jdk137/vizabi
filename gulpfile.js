'use strict';

var path = require('path');
var gulp = require('gulp');
var del = require('del')
var slash = require('slash')
var gutil = require('gulp-util');
var chalk = require('chalk')
var gulpif = require('gulp-if');
var pkg = require('./package');

var sass = require('gulp-ruby-sass');
var minifycss = require('gulp-minify-css');
var scsslint = require('gulp-scss-lint');
var cache = require('gulp-cached');
var mem_cache = require('gulp-memory-cache');
var prefix = require('gulp-autoprefixer')

//useful for ES6 module loader
var rollup = require('rollup');
var uglify = require("gulp-uglify");
var glob = require('glob');
var fs = require('fs');
var q = require('q');

//useful for ES5 build
var concat = require('gulp-concat');
var insert = require('gulp-insert');
var foreach = require('gulp-foreach');
var es = require('event-stream');

var rename = require('gulp-rename');
var sourcemaps = require('gulp-sourcemaps');
var wrapper = require('gulp-wrapper');

var connect = require('gulp-connect');
var opn = require('opn');
var os = require('os');
var watch = require('gulp-watch');
var wait = require('gulp-wait');

var jade = require('gulp-jade');
var zip = require('gulp-zip');
var bump = require('gulp-bump');

// ----------------------------------------------------------------------------
//   Config
// ----------------------------------------------------------------------------

var config = {
  src: './src',
  srcPreview: './preview',
  dest: './build',
  destLib: './build/dist',
  destPreview: './build/preview',
  destDownload: './build/download',
  destDocs: './build/docs',
  bower: './lib'
};

// ----------------------------------------------------------------------------
//   Clean build folder
// ----------------------------------------------------------------------------

gulp.task('clean', function() {
  return del([config.dest]);
});

gulp.task('clean:css', function() {
  return del([path.join(config.destLib, '**/*.css')]);
});

gulp.task('clean:js', function() {
  return del([
    path.join(config.destLib, '**/*.js'),
    path.join(config.destLib, '**/*.js.map')
  ]);
});

gulp.task('clean:indexes', function() {
  return del([path.join(config.src, '**/_index.js')]);
});

gulp.task('clean:preview', function() {
  return del([config.destPreview]);
});

gulp.task('clean:preview:html', function() {
  return del([path.join(config.destPreview, '**/*.html')]);
});

gulp.task('clean:preview:styles', function() {
  return del([path.join(config.destPreview, 'assets/css/main.css')]);
});

gulp.task('clean:preview:js', function() {
  return del([path.join(config.destPreview, 'assets/js/*.js')]);
});

gulp.task('clean:preview:vendor', function() {
  return del([path.join(config.destPreview, 'assets/vendor/**/*')]);
});

gulp.task('clean:preview:data', function() {
  return del([path.join(config.destPreview, 'data')]);
});


// ----------------------------------------------------------------------------
//   Styles
// ----------------------------------------------------------------------------

// TODO: Add SCSS Linting (later, because there are too many errors to fix now)
// gulp.task('scss-lint', function() {
//   return gulp.src(path.join(config.src, '**/*.scss'))
//     .pipe(cache('scsslint'))
//     .pipe(scsslint());
// });

function compileSass(src, dest) {
  return sass(src, {
      style: 'compact'
    })
    .on('error', sass.logError)
    .pipe(prefix("last 1 version", "> 1%", "ie 8", "ie 7"))
    .pipe(minifycss())
    .pipe(gulp.dest(dest));
}

gulp.task('styles', ['clean:css'], function() {
  gutil.log(chalk.yellow("Building CSS..."));
  return compileSass(path.join(config.src, 'assets/styles/vizabi.scss'), config.destLib)
    .on('end', function() {
      gutil.log(chalk.green("Building CSS... DONE!"))
    });
});

// ----------------------------------------------------------------------------
//   Javascript
// ----------------------------------------------------------------------------

function strToFile(string, name) {
  var src = require('stream').Readable({
    objectMode: true
  });
  src._read = function() {
    this.push(new gutil.File({
      cwd: "",
      base: "",
      path: name,
      contents: new Buffer(string)
    }));
    this.push(null);
  }
  return src;
}

//TODO: better way to create index?
function buildImportIndex(folder, subfolder) {
  var deferred = q.defer();
  var search = (subfolder) ? '*/*.js' : '*.js';
  var header = '//file automatically generated during build process\n';
  //delete if exists
  del(path.join(folder, '_index.js'));

  glob(path.join(folder, search), {}, function(err, matches) {
    var str_top = [], str_middle = [], str_btm = [];
    for(var i = 0; i < matches.length; i++) {
      var name = path.basename(matches[i], '.js');
      var rel_path = slash(path.relative(folder, matches[i]));
      str_top.push('import ' + name + ' from \'./' + rel_path + '\';');
      str_middle.push(name + ',');
      str_btm.push(name + ' : '+ name +',');
    }
    str_top = str_top.join('\n');
    str_middle = '\nexport {\n' + str_middle.join('\n') + '\n};';
    str_btm = '\nexport default {\n' + str_btm.join('\n') + '\n};';
    var contents = header + str_top + str_middle + str_btm;
    fs.writeFileSync(path.join(folder, '_index.js'), contents);
    deferred.resolve(); 
  });
  return deferred.promise;
}

function formatTemplateFile(str, filename) {
  var content = str.replace(/'/g, '\"')
    .replace(/(\r\n|\n|\r)/gm, " ")
    .replace(/\s+/g, " ")
    .replace(/<!--[\s\S]*?-->/g, "");
  return "(function() {" +
    "var root = this;" +
    "var s = root.document.createElement('script');" +
    "s.type = 'text/template';" +
    "s.setAttribute('id', '" + filename + "');" +
    "s.innerHTML = '" + content + "';" +
    "root.document.body.appendChild(s);" +
    "}).call(this);";
}

function getTemplates(cb) {
  glob(path.join(config.src, '**/*.html'), {}, function(err, matches) {
    var contents = [];
    for(var i = 0; i < matches.length; i++) {
      var data = fs.readFileSync(matches[i]).toString();
      contents.push(formatTemplateFile(data, path.basename(matches[i])));
    }
    cb(contents.join(''));
  });
}

//build JS with banner and/or sourcemaps
//TODO: improve code quality
function buildJS(dev, cb) {
  getTemplates(function(templates) {
    var banner_str = ['/**',
      ' * ' + pkg.name + ' - ' + pkg.description,
      ' * @version v' + pkg.version,
      ' * @link ' + pkg.homepage,
      ' * @license ' + pkg.license,
      ' */',
      ''
    ].join('\n');

    var version = '; Vizabi._version = "' + pkg.version + '";';

    var options = {
      format: 'umd',
      banner: '/* VIZABI - version 0.8.1 */',
      footer: version + templates,
      moduleName: 'Vizabi',
      dest: path.join(config.destLib, 'vizabi.js'),
      globals: {
        d3: 'd3' //d3 is a global dependency
      }
    };

    gutil.log(chalk.yellow("Bundling JS..."));

    var entryFile = gutil.env.custom || 'gapminder';
    entryFile = (entryFile != 'false') ? 'vizabi-'+entryFile+'.js' : 'vizabi.js';

    gutil.log(chalk.yellow(" > entry file: "+ entryFile));

    rollup.rollup({
      entry: path.join(config.src, entryFile)
    }).then(function(bundle) {
      if(dev) {
        generateSourceMap(bundle, success);
      } else {
        generateMinified(bundle, success);
      }
    });

    function generateSourceMap(bundle, cb) {
      options.sourceMap = true;
      bundle.write(options).then(cb);
    }

    function generateMinified(bundle, cb) {
      var generated = bundle.generate(options);
      strToFile(generated.code, 'vizabi.js')
        .pipe(uglify())
        .on('error', function(err) {
          gutil.log(chalk.red("Bundling JS... ERROR!"));
          gutil.log(err);
        })
        .pipe(gulp.dest(config.destLib))
        .on('end', function() {
          cb();
        });
    }

    function success() {
      gutil.log(chalk.green("Bundling JS... DONE!"));
      cb();
    }
  });
}

gulp.task('buildIndexes', ['clean:indexes'], function() {
  return q.all([
    buildImportIndex(path.join(config.src, '/components/'), true),
    buildImportIndex(path.join(config.src, '/components/buttonlist/dialogs'), true),
    buildImportIndex(path.join(config.src, '/models/')),
    buildImportIndex(path.join(config.src, '/readers/'))
  ]);
});

//with source maps
gulp.task('bundle', ['clean:js', 'buildIndexes'], function(cb) {
  buildJS(true, cb);
});

//without source maps and with banner
gulp.task('bundle:build', ['clean:js', 'buildIndexes'], function(cb) {
  buildJS(false, cb);
});


// ----------------------------------------------------------------------------
//   Preview page
// ----------------------------------------------------------------------------

gulp.task('preview:templates', ['clean:preview:html'], function() {
  gutil.log(chalk.yellow("Compiling preview page..."));
  return gulp.src(path.join(config.srcPreview, '*.jade'))
    .pipe(jade())
    .pipe(gulp.dest(config.destPreview))
    .on('end', function() {
      gutil.log(chalk.green("Compiling preview page... DONE!"))
    });
});

gulp.task('preview:styles', ['clean:preview:styles'], function() {
  gutil.log(chalk.yellow("Building preview CSS..."));
  return compileSass(path.join(config.srcPreview, 'assets/css/main.scss'), path.join(config.destPreview,
      'assets/css'))
    .on('end', function() {
      gutil.log(chalk.green("Building preview CSS... DONE!"))
    });
});

gulp.task('preview:js', ['clean:preview:js'], function() {
  gutil.log(chalk.yellow("Copying preview JS..."));
  return gulp.src(path.join(config.srcPreview, 'assets/js/*.js'))
    .pipe(gulp.dest(path.join(config.destPreview, 'assets/js')))
    .on('end', function() {
      gutil.log(chalk.green("Copying preview JS... DONE!"))
    });
});

gulp.task('preview:vendor', ['clean:preview:vendor'], function() {
  gulp.src(path.join(config.bower, 'font-awesome/css/font-awesome.min.css'))
    .pipe(gulp.dest(path.join(config.destPreview, 'assets/vendor/css')));
  gulp.src(path.join(config.bower, 'font-awesome/fonts/*'))
    .pipe(gulp.dest(path.join(config.destPreview, 'assets/vendor/fonts')));
  gulp.src(path.join(config.bower, 'd3/d3.min.js'))
    .pipe(gulp.dest(path.join(config.destPreview, 'assets/vendor/js')));
});

gulp.task('preview:data', ['clean:preview:data'], function() {
  gutil.log(chalk.yellow("Copying preview data..."));
  return gulp.src('./.data/**/*')
    .pipe(gulp.dest(path.join(config.destPreview, 'data')))
    .on('end', function() {
      gutil.log(chalk.green("Copying preview data... DONE!"))
    });
});


gulp.task('preview', ['preview:templates', 'preview:styles', 'preview:js', 'preview:vendor', 'preview:data'], function(
  cb) {
  return cb();
});

// ----------------------------------------------------------------------------
//   Watch for changes
// ----------------------------------------------------------------------------

//reload only once every 3000ms
var reloadLock = false;

function notLocked() {
  if(!reloadLock) {
    setTimeout(function() {
      reloadLock = false;
    }, 3000);
    reloadLock = true;
  }
  return reloadLock;
}

function reloadOnChange(files) {
  watch(files)
    .pipe(wait(800))
    .pipe(gulpif(notLocked, connect.reload()));
}

gulp.task('watch', function() {
  gulp.watch(path.join(config.srcPreview, '**/*.jade'), ['preview:templates']);
  gulp.watch(path.join(config.srcPreview, '**/*.scss'), ['preview:styles']);
  gulp.watch(path.join(config.srcPreview, '**/*.js'), ['preview:js']);
  gulp.watch(path.join(config.src, '**/*.scss'), ['styles']);
  gulp.watch([path.join(config.src, '**/*.js'), '!' + path.join(config.src, '**/_index.js')], ['bundle']);
  gulp.watch(path.join(config.src, '**/*.html'), ['bundle']);
  //reloading the browser
  reloadOnChange(path.join(config.destPreview, '**/*.js'));
  reloadOnChange(path.join(config.destPreview, '**/*.html'));
  reloadOnChange(path.join(config.destPreview, '**/*.css'));
  reloadOnChange(path.join(config.destLib, 'vizabi.css'));
  reloadOnChange(path.join(config.destLib, 'vizabi.js'));
});

gulp.task('watch-lint', function() {
  gulp.watch(path.join(config.src, '**/*.js'), ['eslint']);
});

// ----------------------------------------------------------------------------
//   Web Server
// ----------------------------------------------------------------------------

gulp.task('connect', ['preview'], function() {
  var webserver = {
    port: 9000,
    root: config.dest,
    livereload: true
  };

  var browser = os.platform() === 'linux' ? 'google-chrome' : (
    os.platform() === 'darwin' ? 'google chrome' : (
      os.platform() === 'win32' ? 'chrome' : 'firefox'));

  connect.server(webserver);
  opn('http://localhost:' + webserver.port + '/preview/', {
    app: browser
  });
});

// ----------------------------------------------------------------------------
//   Compressed file (for download)
// ----------------------------------------------------------------------------

gulp.task('compress', ['styles', 'bundle:build', 'preview'], function() {
  return gulp.src(path.join(config.destLib, '**/*'))
    .pipe(zip('vizabi.zip'))
    .pipe(gulp.dest(config.destDownload));
});

// ----------------------------------------------------------------------------
//   Bump version
// ----------------------------------------------------------------------------

gulp.task('bump', function() {
  var src = gulp.src(['./bower.json', './package.json']);
  var version = gutil.env.version;
  var type = gutil.env.type;

  if(!version && !type) type = 'patch';
  if(version) src = src.pipe(bump({
    version: version
  }));
  else if(type) src = src.pipe(bump({
    type: type
  }));

  return src.pipe(gulp.dest('./'));
});

// ----------------------------------------------------------------------------
//   Command-line tasks
// ----------------------------------------------------------------------------

//Build Vizabi
gulp.task('build', ['compress']);

//Developer task without linting
gulp.task('dev', ['styles', 'bundle', 'watch', 'connect']);

//Serve = build + connect
gulp.task('serve', ['build', 'connect']);

//Default = dev task
gulp.task('default', ['dev']);