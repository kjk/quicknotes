var babelify = require('babelify');
var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var cssnano = require('gulp-cssnano');
var exorcist = require('exorcist');
var gulp = require('gulp');
var mocha = require('gulp-mocha');
var prefix = require('gulp-autoprefixer');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var source = require('vinyl-source-stream');
var tsify = require('tsify');
var uglify = require('gulp-uglify');
var debug = require('gulp-debug');

require('babel-register');

var babelifyOpts = {
  presets: ['es2015', 'react'],
  extensions: ['.tsx', '.ts', '.js', '.jsx']
};

var tsifyOpts = {
  target: 'es6',
  module: 'es2015'
};

var browserifyOpts = {
  entries: ['ts/App.tsx'],
  debug: true,
};

function js() {
  browserify(browserifyOpts)
    .plugin(tsify, tsifyOpts)
    .transform(babelify, babelifyOpts)
    .bundle()
    .pipe(exorcist('s/dist/bundle.js.map'))
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('s/dist'));
}
gulp.task('js', js);

function jsprod() {
  // strip react debug code
  process.env.NODE_ENV = 'production';
  browserify(browserifyOpts)
    .plugin(tsify, tsifyOpts)
    .transform(babelify, babelifyOpts)
    .bundle()
    .pipe(exorcist('s/dist/bundle.min.js.map'))
    .pipe(source('bundle.min.js'))
    .pipe(buffer())
    .pipe(uglify())
    .pipe(gulp.dest('s/dist'));
}

/*
.pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(gulpif(app.minify, uglify()))
    .pipe(gulpif(app.minify, concat(compileTarget.helioscope)))
    .pipe(gulpif(app.minify, rev()))
.pipe(sourcemaps.write('maps'))
*/

gulp.task('jsprod', jsprod);

// TODO: could save 122.452 bytes from the bundle if minifying
// via closure-sompiler instead of uglifyjs, like:
// closure-compiler --js s/dist/bundle.js --js_output_file s/dist/bundle.min.js --compilation_level ADVANCED
// but need to figure out how to run closure directly, in order to preserve
// source maps
function jsprod2() {
  // strip react debug code
  process.env.NODE_ENV = 'production';
  browserify(browserifyOpts)
    .plugin(tsify, tsifyOpts)
    .transform(babelify, babelifyOpts)
    .bundle()
    .pipe(source('bundle.js'))
    .pipe(buffer())
    .pipe(gulp.dest('s/dist'));
}
gulp.task('jsprod2', jsprod2);

function css() {
  return gulp.src('./sass/main.scss')
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(prefix('last 2 versions'))
    .pipe(sourcemaps.write('.')) // this is relative to gulp.dest()
    .pipe(gulp.dest('./s/dist/'));
}
gulp.task('css', css);

function cssprod() {
  return gulp.src('./sass/main.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(prefix('last 2 versions'))
    .pipe(cssnano())
    .pipe(gulp.dest('./s/dist/'));
}
gulp.task('cssprod', cssprod);

function watch() {
  gulp.watch('ts/*', ['js']);
  gulp.watch('./sass/**/*', ['css']);
}
gulp.task('watch', watch);

gulp.task('prod', ['cssprod', 'jsprod']);
gulp.task('default', ['css', 'js']);
gulp.task('build_and_watch', ['default', 'watch']);
