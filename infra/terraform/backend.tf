terraform {
  backend "gcs" {
    bucket = "ellmgw-dev-tfstate"
    prefix = "gateway/dev"
  }
}
