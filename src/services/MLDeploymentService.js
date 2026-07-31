import ProjectRepository from "../repositories/ProjectRepository.js";
import TrainedModelRepository from "../repositories/TrainedModelRepository.js";
import ExperimentRepository from "../repositories/ExperimentRepository.js";
import DeploymentRepository from "../repositories/DeploymentRepository.js";
import DatasetRepository from "../repositories/DatasetRepository.js";

import DjangoDeploymentService from "./django/DjangoDeploymentService.js";

class MLDeploymentService {

    constructor() {
        this.projectRepository =
            ProjectRepository;

        this.trainedModelRepository =
            TrainedModelRepository;

        this.experimentRepository =
            ExperimentRepository;

        this.deploymentRepository =
            DeploymentRepository;

        this.datasetRepository =
            DatasetRepository;

        this.djangoDeploymentService =
            DjangoDeploymentService;
    }

    // ===================================================
    // List Deployments For A Project
    // (enriched with model + dataset info for predict/report)
    // ===================================================

    async listByProject(
        projectId,
    ) {
        await this.getProject(projectId);

        const experiments =
            await this.experimentRepository.findByProjectId(
                projectId,
            );

        if (!experiments.length) {
            return [];
        }

        const experimentById = new Map();
        for (const exp of experiments) {
            experimentById.set(exp._id.toString(), exp);
        }

        const trainedModels =
            await this.trainedModelRepository.findByExperimentIds(
                experiments.map((e) => e._id),
            );

        const trainedModelById = new Map();
        for (const tm of trainedModels) {
            trainedModelById.set(tm._id.toString(), tm);
        }

        const deployments =
            await this.deploymentRepository.findByTrainedModelIds(
                trainedModels.map((t) => t._id),
            );

        const enriched = [];

        for (const deployment of deployments) {
            const trainedModel =
                trainedModelById.get(
                    deployment.trained_model_id.toString(),
                );

            const experiment = trainedModel
                ? experimentById.get(
                      trainedModel.experiment_id.toString(),
                  )
                : null;

            let datasetId = null;
            let version = null;

            if (experiment) {
                const datasetVersion =
                    await this.datasetRepository.getDatasetVersionById(
                        experiment.dataset_version_id,
                    );

                if (datasetVersion) {
                    datasetId =
                        datasetVersion.dataset_id;
                    version =
                        datasetVersion.version_number;
                }
            }

            enriched.push({
                _id: deployment._id,
                endpoint_name: deployment.endpoint_name,
                endpoint_url: deployment.endpoint_url,
                status: deployment.status,
                deployed_at: deployment.deployed_at,
                trained_model_id: deployment.trained_model_id,
                model_name: trainedModel?.model_name ?? null,
                algorithm: experiment?.algorithm ?? null,
                problem_type: experiment?.problem_type ?? null,
                target_column: experiment?.target_column ?? null,
                evaluation: experiment?.evaluation ?? {},
                dataset_id: datasetId,
                version,
            });
        }

        return enriched;
    }

    // ===================================================
    // Get Project
    // ===================================================

    async getProject(
        projectId,
    ) {
        const project =
            await this.projectRepository.getProjectById(
                projectId,
            );

        if (!project) {
            throw new Error(
                "Project not found.",
            );
        }

        return project;
    }

    // ===================================================
    // Get Trained Model
    // ===================================================

    async getTrainedModel(
        trainedModelId,
    ) {
        const trainedModel =
            await this.trainedModelRepository.findById(
                trainedModelId,
            );

        if (!trainedModel) {
            throw new Error(
                "Trained model not found.",
            );
        }

        return trainedModel;
    }

    // ===================================================
    // Validate Project Ownership
    // ===================================================

    async validateProjectOwnership(
        projectId,
        trainedModel,
    ) {
        const experiment =
            await this.experimentRepository.findById(
                trainedModel.experiment_id,
            );

        if (
            !experiment
        ) {
            throw new Error(
                "Experiment not found.",
            );
        }

        if (
            experiment.project_id.toString() !==
            projectId.toString()
        ) {
            throw new Error(
                "The trained model does not belong to the specified project.",
            );
        }

        return true;
    }

    // ===================================================
    // Validate Deployment
    // ===================================================

    validateDeployment(
        trainedModel,
    ) {
        // ------------------------------------------
        // Model Path Exists
        // ------------------------------------------

        if (
            !trainedModel.model_path
        ) {
            throw new Error(
                "Model path not found.",
            );
        }

        // ------------------------------------------
        // Model Status
        // ------------------------------------------

        if (
            trainedModel.status !==
            "active"
        ) {
            throw new Error(
                "Model is not available for deployment.",
            );
        }

        return true;
    }

    // ===================================================
    // Validate Model Using Django
    // ===================================================

    async deployUsingDjango(
        modelPath,
    ) {
        const response =
            await this.djangoDeploymentService.deployModel(
                {
                    model_path:
                        modelPath,
                },
            );

        if (
            !response.success
        ) {
            throw new Error(
                response.message,
            );
        }

        return response.data;
    }

    // ===================================================
    // Deploy Machine Learning Model
    // ===================================================

    async deployModel(
        deploymentData,
    ) {
        const {
            project_id,
            trained_model_id,
        } = deploymentData;

        // ==========================================
        // Get Project
        // ==========================================

        await this.getProject(
            project_id,
        );

        // ==========================================
        // Get Trained Model
        // ==========================================

        const trainedModel =
            await this.getTrainedModel(
                trained_model_id,
            );

        // ==========================================
        // Validate Project Ownership
        // ==========================================

        await this.validateProjectOwnership(
            project_id,
            trainedModel,
        );

        // ==========================================
        // Validate Deployment
        // ==========================================

        this.validateDeployment(
            trainedModel,
        );

        // ==========================================
        // Check Existing Deployment
        // ==========================================

        const existingDeployment =
            await this.deploymentRepository.findActiveDeploymentByModelId(
                trained_model_id,
            );

        if (
            existingDeployment
        ) {
            throw new Error(
                "Model is already deployed.",
            );
        }

        // ==========================================
        // Validate Model Using Django
        // ==========================================

        await this.deployUsingDjango(
            trainedModel.model_path,
        );

        // ==========================================
        // Create Deployment Record
        // ==========================================

        const deployment =
            await this.deploymentRepository.create(
                {
                    trained_model_id,
                },
            );

        // ==========================================
        // Return Response
        // ==========================================

        return {
            deployment,
        };
    }
}

export default new MLDeploymentService();