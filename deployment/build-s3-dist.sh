#!/bin/bash
#
# This script will perform the following tasks:
#   1. Remove any old dist files from previous runs.
#   2. Install dependencies for the cdk-solution-helper; responsible for
#      converting standard 'cdk synth' output into solution assets.
#   3. Build and synthesize your CDK project.
#   4. Run the cdk-solution-helper on template outputs and organize
#      those outputs into the /global-s3-assets folder.
#   5. Organize source code artifacts into the /regional-s3-assets folder.
#   6. Remove any temporary files used for staging.
#
# This script should be run from the repo's deployment directory
# cd deployment
# ./build-s3-dist.sh source-code-bucket-name solution-name solution-version template-bucket-name template_account_id dist_quicksight_namespace
#
# Parameters:
#  - bucket_name: Name for the S3 bucket where the source code resides. The template will append '-[region_name]' to this bucket name.
#    For example: ./build-s3-dist.sh my-source-code-bucket my-solution v1.0.0 my-solution-cf-template-bucket 11111111 default
#    The template will then expect the source code to be located in the my-source-code-bucket-[region_name] bucket
#  - solution_name: Name of the solution
#  - version: Version of the solution
#  - template_bucket_name: Name for the S3 bucket where the cloudformation templates reside
#  - template_account_id: AWS account id where the cloudformation templates are located
#  - dist_quicksight_namespace: Namespace in quicksight arn.


[ "$DEBUG" == 'true' ] && set -x
set -e

# Important: CDK global version number
cdk_version=1.75.0

# Check to see if input has been provided:
if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ] || [ -z "$4" ] || [ -z "$5" ] || [ -z "$6" ]; then
    echo "Please provide all required parameters for the build script"
    echo "For example: ./build-s3-dist.sh solutions trademarked-solution-name v1.2.0 template-bucket-name template_account_id solutions"
    exit 1
fi

bucket_name="$1"
solution_name="$2"
solution_version="$3"
template_bucket_name="$4"
template_account_id="$5"
dist_quicksight_namespace="$6"

dashed_version="${solution_version//./$'_'}"

do_cmd () {
    echo "------ EXEC $*"
    $*
    rc=$?
    if [ $rc -gt 0 ]
    then
            echo "Aborted - rc=$rc"
            exit $rc
    fi
}

do_replace() {
    replace="s/$2/$3/g"
    file=$1
    do_cmd sed -i -e $replace $file
}

#------------------------------------------------------------------------------
# INITIALIZATION
#------------------------------------------------------------------------------
# solution_env.sh must exist in the solution root. It is the definitive source
# for solution ID, name, and trademarked name
# Ex:
# #!/bin/bash
# SOLUTION_ID='SO0111'
# SOLUTION_NAME='AWS Security Hub Automated Response & Remediation'
# SOLUTION_TRADEMARKEDNAME='aws-security-hub-automated-response-and-remediation'
if [[ -e './solution_env.sh' ]]; then
    chmod +x ./solution_env.sh
    source ./solution_env.sh
else
    echo "solution_env.sh is missing from the solution root."
    exit 1
fi

if [[ -z "$SOLUTION_ID" ]]; then
    echo "SOLUTION_ID is missing from ../solution_env.sh"
    exit 1
else
    export SOLUTION_ID
fi

if [[ -z "$SOLUTION_NAME" ]]; then
    echo "SOLUTION_NAME is missing from ../solution_env.sh"
    exit 1
else
    export SOLUTION_NAME
fi

if [[ -z "$SOLUTION_TRADEMARKEDNAME" ]]; then
    echo "SOLUTION_TRADEMARKEDNAME is missing from ../solution_env.sh"
    exit 1
else
    export SOLUTION_TRADEMARKEDNAME
fi

# Get reference for all important folders
template_dir="$PWD"
temp_work_dir="${template_dir}/temp"
staging_dist_dir="$template_dir/staging"
template_dist_dir="$template_dir/global-s3-assets"
build_dist_dir="$template_dir/regional-s3-assets"
source_dir="$template_dir/../source"

echo "------------------------------------------------------------------------------"
echo "[Init] Remove any old dist files from previous runs"
echo "------------------------------------------------------------------------------"
do_cmd rm -rf $template_dist_dir
do_cmd mkdir -p $template_dist_dir

do_cmd rm -rf $build_dist_dir
do_cmd mkdir -p $build_dist_dir

do_cmd rm -rf $staging_dist_dir
do_cmd mkdir -p $staging_dist_dir

do_cmd rm -rf $temp_work_dir
do_cmd mkdir -p $temp_work_dir

echo "------------------------------------------------------------------------------"
echo "[Init] Install dependencies for the cdk-solution-helper"
echo "------------------------------------------------------------------------------"
cd $template_dir/cdk-solution-helper
do_cmd npm install
# do_cmd npm ci --only=prod

echo "------------------------------------------------------------------------------"
echo "[Copy] Copy source to temp and remove unwanted files"
echo "------------------------------------------------------------------------------"
do_cmd cp -r $source_dir/* $temp_work_dir # make a copy to work from
cd $temp_work_dir
# remove node_modules
find . -name node_modules | while read file;do rm -rf $file; done
# remove package-lock.json
find . -name package-lock.json | while read file;do rm $file; done

echo "------------------------------------------------------------------------------"
echo "[Init] Install dependencies for Lambda functions"
echo "------------------------------------------------------------------------------"
cd $temp_work_dir/lambda
for folder in */ ; do
    cd "$folder"

    function_name=${PWD##*/}
    echo "Installing dependencies for $function_name"

    for temp_folder in ".nyc_output" ".venv-prod" ".venv-test" "__pycache__"; do
        if [ -d "$temp_folder" ]; then
            echo "$temp_folder exists, removing it"
            do_cmd rm -rf $temp_folder
        fi
    done

    if [ -e "requirements.txt" ]; then
        pip3 install -q -r requirements.txt --upgrade --target ./
    elif [ -e "package.json" ]; then
        # do_cmd npm ci --only=prod
        do_cmd npm install
    fi

    cd ..
done

echo "------------------------------------------------------------------------------"
echo "[Synth] CDK Project"
echo "------------------------------------------------------------------------------"
cd $temp_work_dir
do_cmd npm install      # local install per package.json
do_cmd npm install aws-cdk@$cdk_version
export PATH=$(npm bin):$PATH
do_cmd npm run build

## added as workaround for construct failure as aws solutions constructs override warning
## diff-merge function has an issue with the Duration CDK class
export overrideWarningsEnabled=false
node_modules/aws-cdk/bin/cdk synth --output=$staging_dist_dir

cd $staging_dist_dir
do_cmd rm tree.json manifest.json cdk.out

echo "------------------------------------------------------------------------------"
echo "[Packing] Template artifacts"
echo "------------------------------------------------------------------------------"
do_cmd cp $staging_dist_dir/*.template.json $template_dist_dir/

for f in $template_dist_dir/*.template.json; do
    do_cmd mv -- "$f" "${f%.template.json}.template"
done

echo "------------------------------------------------------------------------------"
echo "[Packing] Build nested template and configure source code for lambda functions"
echo "------------------------------------------------------------------------------"
node $template_dir/cdk-solution-helper/index

echo "------------------------------------------------------------------------------"
echo "Update placeholders in template with actual values"
echo "------------------------------------------------------------------------------"
for file in $template_dist_dir/*.template
do
    do_replace $file %%BUCKET_NAME%% $bucket_name
    do_replace $file %%SOLUTION_NAME%% $solution_name
    do_replace $file %%VERSION%% $solution_version
    do_replace $file %%TEMPLATE_BUCKET_NAME%% $template_bucket_name
    do_replace $file %%TEMPLATE_ACCOUNT_ID%% $template_account_id
    do_replace $file %%DIST_QUICKSIGHT_NAMESPACE%% $dist_quicksight_namespace
    do_replace $file %%DASHED_VERSION%% $dashed_version
done

echo "------------------------------------------------------------------------------"
echo "[Packing] Source code artifacts"
echo "------------------------------------------------------------------------------"
# ... For each asset.* source code artifact in the temporary /staging folder...
cd $staging_dist_dir
for d in `find . -mindepth 1 -maxdepth 1 -type d`; do
    # Rename the artifact, removing the period for handler compatibility
    pfname="$(basename -- $d)"
    fname="$(echo $pfname | sed -e 's/\.//g')"
    do_cmd mv $d $fname

    # Zip artifacts from asset folder
    cd $fname
    do_cmd zip -r ../$fname.zip *
    cd ..

    # Copy the zipped artifact from /staging to /regional-s3-assets
    do_cmd cp $fname.zip $build_dist_dir

    # Remove the old artifacts from /staging
    do_cmd rm -rf $fname
    do_cmd rm $fname.zip
done

echo "------------------------------------------------------------------------------"
echo "[Cleanup] Remove temporary files"
echo "------------------------------------------------------------------------------"
do_cmd rm -rf $staging_dist_dir
do_cmd rm -rf $temp_work_dir

# Return to the directory where we started
cd $template_dir