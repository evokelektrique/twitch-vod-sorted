const parse = require("fast-json-parse"); // Dumb package
const fs = require("fs");
const path = require("path");
var ffmpeg = require("fluent-ffmpeg");
const { exec } = require("child_process");

// Paths
const json_chat_path = path.resolve("./samples/out.json");
const video_input_path = path.resolve("./samples/out.mp4");
const storage_path = path.resolve("./samples/output");

// Parse
const result = parse(fs.readFileSync(json_chat_path)); // Didn't work with "JSON.parse"

// Extracted data
const video_information = result.value.video;
const video_comments = result.value.comments;

async function main(method) {
    // Extract and sort comments
    let extracted_comments = await extract_comments(video_comments);
    let sorted_comments = await sort_comments(extracted_comments);
    sorted_comments = sorted_comments.slice(0, 10);

    const options = {
        output_format: "mp4",
        output_name: "forsen",
    };

    if (method === "EXTRACT") {
        // Extract video
        await extract_video_by_comments_timestamps(
            ffmpeg,
            options,
            video_input_path,
            storage_path,
            sorted_comments,
            video_information
        );
    }

    if (method === "MERGE") {
        const abs_path = "./samples/output/";
        let extracted_videos = fs.readdirSync(path.resolve(abs_path));
        // extracted_videos = extracted_videos.map((video) => abs_path + video);

        const merged_video = merge_videos(
            ffmpeg,
            extracted_videos,
            options,
            storage_path
        );

        console.log(merged_video);
    }
}

const method = "EXTRACT";
main(method);

function merge_videos(ffmpeg, extracted_videos, options, storage_path) {
    var file_stream = fs.createWriteStream(storage_path + "/files.txt");
    file_stream.on("error", function (err) {
        console.log(err);
    });
    extracted_videos.forEach((file) => {
        console.log(file);
        file_stream.write("file " + file + "\n");
    });
    file_stream.end();

    exec(
        `ffmpeg -f concat -i ${storage_path}/files.txt -c copy ${storage_path}/${options.output_name}.${options.output_format}`,
        (err, stdout, stderr) => {
            if (err) {
                //some err occurred
                console.error(err);
            } else {
                // the *entire* stdout and stderr (buffered)
                console.log(`stdout: ${stdout}`);
                console.log(`stderr: ${stderr}`);
            }
        }
    );
}

function extract_video_by_comments_timestamps(
    ffmpeg,
    options,
    video_input_path,
    storage_path,
    sorted_comments,
    video_information
) {
    return new Promise((resolve, reject) => {
        const videos = [];

        sorted_comments.forEach((comment) => {
            const diff = get_duration(comment, video_information, sorted_comments);
            const output_path = `${storage_path}/${diff}.${options.output_format}`;
            // // Save video
            ffmpeg(video_input_path)
                .size("640x480")
                .seek(diff)
                .frames(3)
                .on("error", function (err) {
                    console.log("An error occurred: " + err.message);
                })
                .on("end", function () {
                    console.log("Processing finished !", output_path);
                })
                .save(output_path);

            videos.push(output_path);
        });

        resolve(videos);
    });
}

function sort_comments(comments) {
    return new Promise((resolve, reject) => {
        const sorted_comments = comments.sort(function (a, b) {
            return a.emote.localeCompare(b.emote);
        });

        resolve(sorted_comments);
    });
}

function extract_comments(comments) {
    return new Promise((resolve, reject) => {
        const emotes = [];

        comments.forEach((comment) => {
            if (comment.message.emoticons.length > 0) {
                // Count first emotes only
                const data = {
                    created_at: new Date(comment.created_at),
                    offset: comment.content_offset_seconds,
                    emote: comment.message.fragments[0].text,
                };
                emotes.push(data);
            }
        });

        resolve(emotes);
    });
}

function get_duration(current_comment, video_information, video_comments) {
    // console.log("video", video_information);
    // console.log("first", video_comments[0].created_at);
    // console.log("last", video_comments[video_comments.length - 1].created_at);

    const dif =  current_comment.created_at.getTime() - video_comments[0].created_at.getTime();
    const diff_in_seconds = Math.abs(dif / 1000);

    console.log("current", current_comment.created_at, "diff", diff_in_seconds);

    return diff_in_seconds;
}
