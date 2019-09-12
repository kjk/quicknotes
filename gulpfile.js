var argv = require("yargs").argv;
var babelify = require("babelify");
var browserify = require("browserify");
var buffer = require("vinyl-buffer");
var cssnano = require("gulp-cssnano");
var exorcist = require("exorcist");
var gulp = require("gulp");
var prefix = require("gulp-autoprefixer");
var sass = require("gulp-sass");
var sourcemaps = require("gulp-sourcemaps");
var source = require("vinyl-source-stream");
var through = require("through2");
var tsify = require("tsify");
var uglify = require("gulp-uglify");

var showDeps = (argv.show_deps || argv["show-deps"]) !== undefined;

require("babel-register");

var babelifyOpts = {
  presets: ["es2015", "react"],
  extensions: [".tsx", ".ts", ".js", ".jsx"]
};

var tsifyOpts = {
  target: "es6",
  module: "es2015"
};

var browserifyOpts = {
  entries: ["ts/App.tsx"],
  debug: true
};

function printDeps(b) {
  if (!showDeps) {
    return;
  }
  // for debugging dump (flattened and inverted) dependency tree
  // b is browserify instance
  // TODO: should also write to a file for more post-processing
  b.pipeline.get("deps").push(
    through.obj(function(row, enc, next) {
      // format of row is { id, file, source, entry, deps }
      // deps is {} where key is module name and value is file it comes from
      console.log(row.file || row.id);
      for (let k in row.deps) {
        const v = row.deps[k];
        console.log("  ", k, ":", v);
      }
      next();
    })
  );
}

function js(cb) {
  var b = browserify(browserifyOpts);
  printDeps(b);
  b
    .plugin(tsify, tsifyOpts)
    .transform(babelify, babelifyOpts)
    .bundle()
    .pipe(exorcist("static/dist/bundle.js.map"))
    .pipe(source("bundle.js"))
    .pipe(gulp.dest("static/dist"));
  printDeps(b);
  cb();
}

function jsprod(cb) {
  // strip react debug code
  process.env.NODE_ENV = "production";
  var b = browserify(browserifyOpts);
  printDeps(b);
  b
    .plugin(tsify, tsifyOpts)
    .transform(babelify, babelifyOpts)
    .bundle()
    .pipe(exorcist("static/dist/bundle.min.js.map"))
    .pipe(source("bundle.min.js"))
    .pipe(buffer())
    .pipe(uglify())
    .pipe(gulp.dest("static/dist"));
  cb();
}

/*
.pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(gulpif(app.minify, uglify()))
    .pipe(gulpif(app.minify, concat(compileTarget.helioscope)))
    .pipe(gulpif(app.minify, rev()))
.pipe(sourcemaps.write('maps'))
*/

// TODO: could save 122.452 bytes from the bundle if minifying
// via closure-sompiler instead of uglifyjs, like:
// closure-compiler --js static/dist/bundle.js --js_output_file static/dist/bundle.min.js --compilation_level ADVANCED
// but need to figure out how to run closure directly, in order to preserve
// source maps
function jsprod2(cb) {
  // strip react debug code
  process.env.NODE_ENV = "production";
  var b = browserify(browserifyOpts);
  printDeps(b);
  b
    .plugin(tsify, tsifyOpts)
    .transform(babelify, babelifyOpts)
    .bundle()
    .pipe(source("bundle.js"))
    .pipe(buffer())
    .pipe(gulp.dest("static/dist"));
  cb();
}

function css(cb) {
  gulp
    .src("./sass/main.scss")
    .pipe(sourcemaps.init())
    .pipe(sass().on("error", sass.logError))
    .pipe(prefix("last 2 versions"))
    .pipe(sourcemaps.write(".")) // this is relative to gulp.dest()
    .pipe(gulp.dest("./static/dist/"));
  cb();
}

function cssprod(cb) {
  gulp
    .src("./sass/main.scss")
    .pipe(sass().on("error", sass.logError))
    .pipe(prefix("last 2 versions"))
    .pipe(cssnano())
    .pipe(gulp.dest("./static/dist/"));
  cb();
}

function watch() {
  gulp.watch("ts/*", ["js"]);
  gulp.watch("./sass/**/*", ["css"]);
}

exports.jsprod2 = jsprod2;
exports.css = css;
exports.cssprod = cssprod;
exports.js = js;
exports.jsprod = jsprod;
exports.watch = watch;
exports.prod = gulp.series(cssprod, jsprod);
exports.default = gulp.series(css, js);
exports.build_and_watch = gulp.series(exports.default, watch);
