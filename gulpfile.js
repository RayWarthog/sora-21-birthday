const { src, dest, series } = require('gulp');
const rename = require('gulp-rename');
const cleanCSS = require('gulp-clean-css');

const handlebars = require('gulp-compile-handlebars');
const htmlmin = require('gulp-htmlmin');

const babel = require('gulp-babel');
const uglify = require('gulp-uglify');

const csvparse = require('csv-parse/lib/sync');
const message_csv_file = 'src/messages.csv';
const fs = require('fs').promises;

const countries = require("i18n-iso-countries");

const imagemin = require('gulp-imagemin');

const path = require('path')

function minifycss() {
    return src('src/*.css')
        .pipe(cleanCSS({
            level: 2
        }))
        .pipe(dest('dist'));
}

async function build_html() {
    let message_data = []

    let content = await fs.readFile(message_csv_file);
    let records = csvparse(content, { from_line: 2 });

    records.map(
        record => {
            let timestamp = record[0];
            let username = record[1].trim();
            let twitter = record[2].trim();
            let country = record[3];
            let message = record[4];
            let message_jp = record[11];

            let country_code = '';
            let country_name = '';

            // if (record[6] !== '') {
            //     message = record[6];
            // }
            
            if (country) {
                country = country.replace(/-/g, ' ')
                if (country == 'United States') {
                    country = 'United States of America'
                }
                search_country_code = countries.getAlpha2Code(country, 'en');
                if (search_country_code) {
                    country_code = search_country_code.toLowerCase();
                    country_name = countries.getName(search_country_code, "en") + ' / ' + countries.getName(search_country_code, "ja");
                }
            }

            // https://stackoverflow.com/questions/15033196/using-javascript-to-check-whether-a-string-contains-japanese-characters-includi/15034560
            var jpCharacters = message.match(/[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]/);

            // if there isn't a match, then message is not in Japanese, pass this value to the handlebars file. 
            // if there is no JP character and translation is not provided, then the message is in JP
            var isMsgInJP = !(jpCharacters === null) && record[6] === ""

            
            if (twitter.startsWith("@") || twitter.startsWith("???")) {
                twitter = twitter.substring(1);
            }

            message_row = {
                timestamp: timestamp,
                username: username,
                twitter: twitter,
                country: country,
                country_name: country_name,
                country_code: country_code,
                message: message,
                isMsgInJP: isMsgInJP,
                message_jp: message_jp
            };
            message_data.push(message_row);
        }
    );

    // Artbook
    let artbook_rawdata = await fs.readFile('src/art.json')
    let artbook_data = JSON.parse(artbook_rawdata)

    for (i = 0; i < artbook_data.length; i++) {
        let thumbnail_fname = path.parse(artbook_data[i]['fullpage']).name.concat('_t.jpg')
        artbook_data[i]['thumbnail'] = "art/thumbs/".concat(thumbnail_fname)
        artbook_data[i]['thumbnail_small'] = "art/thumbs_small/".concat(thumbnail_fname)
        let country = artbook_data[i].country;
        let country_code = ""
        let country_name = ""
        if(country) {
            if (country == 'United States') {
                country = 'United States of America'
            }
            country = country.replace(/-/g, ' ')
            search_country_code = countries.getAlpha2Code(country, 'en');
            if (search_country_code) {
                country_code = search_country_code.toLowerCase();
                country_name = countries.getName(search_country_code, "en") + ' / ' + countries.getName(search_country_code, "ja");
            }
        }
        artbook_data[i]["country_code"] = country_code
        artbook_data[i]["country_name"] = country_name
      }
      

    let template_data = {
        messages: message_data,
        artbook_data: artbook_data
    };
    let htmlminoptions = {
        minifyCSS: true,
        minifyJS: true,
        collapseBooleanAttributes: true,
        collapseWhitespace: true,
        collapseInlineTagWhitespace: true,
        removeAttributeQuotes: true,
        removeComments: true,
        removeEmptyAttributes: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true
    }

    return src('src/index.handlebars')
        .pipe(handlebars(template_data))
        .pipe(htmlmin(htmlminoptions))
        .pipe(rename('index.html'))
        .pipe(dest('.'));
}

function minifyjs() {
    return src('src/*.js')
        .pipe(babel({
            presets: ['@babel/preset-env']
        }))
        .pipe(uglify())
        .pipe(dest('dist'))
}

function minifyimg() {
    return src('src/img/**/*')
        .pipe(imagemin([
            imagemin.optipng({
                interlaced: true
            })
        ]))
        .pipe(dest('dist/img'))
}

exports.build_full = series(minifycss, build_html, minifyjs, minifyimg);
exports.build = series(minifycss, build_html, minifyjs);
