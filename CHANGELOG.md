# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.7] - 2024-01-30
### Fixed

- Handling of aws sdk v3 errors

## [1.8.6] - 2023-12-21

### Changed

- Upgraded lambdas from node 16 to node 20
- Upgraded lambdas from python 3.10 to python 3.11
- Upgraded aws sdk from v2 to v3

## [1.8.5] - 2023-10-26

### Changed

- Upgraded @babel/traverse to mitigate CVE-2023-45133
- Upgraded chaijs/get-func-name to mitigate CVE-2023-43646
- Upgraded urllib3 to mitigate CVE-2023-45803 and CVE-2023-43804
- Upgraded other dev dependencies (moto, pytest, pytest-env)

## [1.8.4] - 2023-08-07

### Changed

- Refactored code to reduce complexity
- Upgraded requests to mitigate CVE-2023-32681
- Upgraded semver to mitigate  CVE-2022-25883
- Upgraded cryptography

## [1.8.3] - 2023-04-18

### Changed

- Fixed S3 logging bucket setting
- Fixed missing userName in codecommit event when pushes are made by assumed role credentials
- Upgraded Werkzeug to mitigate CVE-2023-25577
- Upgraded cryptography to mitigate CVE-2023-23931
- upgraded tenacity
- Added timeout to requests call
- Upgraded Athena engine version 3

## [1.8.2] - 2023-01-13

### Security

- Upgrade JSON5 to mitigate CVE-2022-46175
- Upgrade certifi to mitigate CVE-2022-23491

## [1.8.1] - 2022-12-05

### Added

- Added Application Registry

### Changed

- Upgraded node 14 to 16

## [1.8.0] - 2022-10-31

### Added

- Added multi-account multi-region data ingestion
- Added tag filter for AWS CodeCommit, CodeBuild and CodePipeline

## [1.5.0] - 2022-04-19

### Added

- Added GitHub integration - GitHub activity metric for push events
- Added Mean Time to Recovery (MTTR) metric for Code Pipeline

## [1.1.0] - 2021-06-16

### Added

- Metrics visualization for codebuild and codepipeline Events.

## [1.0.0] - 2021-03-22

### Added

- Initial version
