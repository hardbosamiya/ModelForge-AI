import axios from "axios";
import FormData from "form-data";

class DjangoDatasetService {
  constructor() {
    this.baseURL = process.env.DJANGO_API_URL;
  }

  // POST JSON to Django and surface Django's own error message/status
  // instead of the opaque axios "Request failed with status code XXX".
  async _post(url, body) {
    try {
      const response = await axios.post(url, body);
      return response.data;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.detail ||
        error.message;
      const err = new Error(message);
      err.statusCode = error.response?.status || 500;
      throw err;
    }
  }

  // ==============================
  // Upload Dataset
  // ==============================
  async uploadDataset(
    uploadedFile,
    datasetId,
    version = 1
  ) {
    const formData = new FormData();

    formData.append(
      "file",
      uploadedFile.buffer,
      {
        filename: uploadedFile.originalname,
        contentType: uploadedFile.mimetype,
      }
    );

    formData.append(
      "dataset_id",
      datasetId.toString()
    );

    formData.append(
      "version",
      version.toString()
    );

    const response = await axios.post(
      `${this.baseURL}/datasets/upload/`,
      formData,
      {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    return response.data;
  }

  // ==============================
  // Dataset Validation
  // ==============================
  async validateDataset(
    datasetId,
    version,
    datasetType,
  ) {

    return this._post(
      `${this.baseURL}/datasets/validation/`,
      {
        dataset_id: datasetId,
        version,
        dataset_type: datasetType,
      },
    );

  }

  // ==============================
  // Dataset Profiling
  // ==============================
  async profileDataset(
    datasetId,
    version = 1
  ) {
    return this._post(
      `${this.baseURL}/datasets/profile/`,
      {
        dataset_id: datasetId,
        version,
      }
    );
  }

  // ==============================
  // Data Cleaning
  // ==============================
  async cleanDataset(
    datasetId,
    version,
    cleaningOptions
  ) {
    return this._post(
      `${this.baseURL}/datasets/clean/`,
      {
        dataset_id: datasetId,
        version,
        cleaning_options: cleaningOptions,
      }
    );
  }

  // ==============================
  // Feature Engineering
  // ==============================
  async featureEngineering(
    datasetId,
    version,
    featureEngineeringOptions,
    targetColumn
  ) {
    return this._post(
      `${this.baseURL}/datasets/feature-engineering/`,
      {
        dataset_id: datasetId,
        version,
        feature_engineering_options: featureEngineeringOptions,
        target_column: targetColumn
      }
    );
  }

  // ============================== 
  // EDA
  // ==============================
  async generateEDA(
    datasetId,
    version = 1
  ) {
    return this._post(
      `${this.baseURL}/datasets/eda/`,
      {
        dataset_id: datasetId,
        version,
      }
    );
  }
}



export default new DjangoDatasetService();