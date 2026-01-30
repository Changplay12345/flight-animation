"""
Cloudflare R2 Storage Service for Parquet Files
"""
import boto3
from botocore.config import Config
import os

# R2 Configuration
R2_ACCOUNT_ID = "b045d1e42e79852adba6e64701bec8fc"
R2_ACCESS_KEY = "43329b2db999e42b126206485dab310b"
R2_SECRET_KEY = "e54d2dc6fec0b76216c04ba74a67b988c2ec0bd17d0a8bfab1f0e2e03b879cb3"
R2_BUCKET_NAME = "flight-parquet"
R2_PUBLIC_URL = "https://pub-f32d1de24fcd4e239c43ee1c3e9777f9.r2.dev"
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Create S3 client for R2
s3_client = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY,
    aws_secret_access_key=R2_SECRET_KEY,
    config=Config(signature_version='s3v4'),
    region_name='auto'
)


def upload_parquet_to_r2(local_path: str, object_key: str) -> str:
    """
    Upload a parquet file to R2 and return the public URL.
    
    Args:
        local_path: Path to the local parquet file
        object_key: The key (filename) to use in R2
        
    Returns:
        Public URL to access the file
    """
    try:
        # Upload file
        s3_client.upload_file(
            local_path,
            R2_BUCKET_NAME,
            object_key,
            ExtraArgs={'ContentType': 'application/octet-stream'}
        )
        
        # Return public URL
        public_url = f"{R2_PUBLIC_URL}/{object_key}"
        return public_url
        
    except Exception as e:
        raise Exception(f"Failed to upload to R2: {str(e)}")


def check_parquet_exists_in_r2(object_key: str) -> bool:
    """
    Check if a parquet file exists in R2.
    
    Args:
        object_key: The key (filename) to check
        
    Returns:
        True if exists, False otherwise
    """
    try:
        s3_client.head_object(Bucket=R2_BUCKET_NAME, Key=object_key)
        return True
    except:
        return False


def get_parquet_public_url(object_key: str) -> str:
    """
    Get the public URL for a parquet file in R2.
    
    Args:
        object_key: The key (filename)
        
    Returns:
        Public URL
    """
    return f"{R2_PUBLIC_URL}/{object_key}"


def delete_parquet_from_r2(object_key: str) -> bool:
    """
    Delete a parquet file from R2.
    
    Args:
        object_key: The key (filename) to delete
        
    Returns:
        True if deleted, False otherwise
    """
    try:
        s3_client.delete_object(Bucket=R2_BUCKET_NAME, Key=object_key)
        return True
    except:
        return False


def list_parquets_in_r2() -> list[dict]:
    """
    List all parquet files in R2 bucket.
    
    Returns:
        List of parquet file info with name and public URL
    """
    try:
        response = s3_client.list_objects_v2(Bucket=R2_BUCKET_NAME)
        files = []
        
        if 'Contents' in response:
            for obj in response['Contents']:
                key = obj['Key']
                if key.endswith('.parquet'):
                    # Extract dataset name from filename
                    dataset_name = key.replace('.parquet', '')
                    files.append({
                        "table_name": dataset_name,
                        "r2_url": f"{R2_PUBLIC_URL}/{key}",
                        "size_bytes": obj['Size'],
                        "size_mb": round(obj['Size'] / 1024 / 1024, 2),
                        "last_modified": obj['LastModified'].isoformat()
                    })
        
        # Update manifest file in R2 for direct access
        update_manifest_in_r2(files)
        
        return files
    except Exception as e:
        print(f"Error listing R2 bucket: {e}")
        return []


def update_manifest_in_r2(files: list[dict]) -> None:
    """
    Update the datasets.json manifest file in R2.
    This allows the frontend to fetch the list directly from R2 without tunnel.
    """
    import json
    try:
        manifest = json.dumps(files)
        s3_client.put_object(
            Bucket=R2_BUCKET_NAME,
            Key='datasets.json',
            Body=manifest.encode('utf-8'),
            ContentType='application/json'
        )
    except Exception as e:
        print(f"Error updating manifest: {e}")
