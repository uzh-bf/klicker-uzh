# Workflow Orchestration with Hatchet

## Overview

KlickerUZH has integrated Hatchet as the primary workflow orchestration platform, transitioning from Azure Service Bus for distributed task processing and response handling. Hatchet provides a robust, scalable solution for managing complex workflows across the application ecosystem.

## Hatchet Platform Components

### Core Platform Services

- **Hatchet API**: REST API for workflow management and task submission
- **Hatchet Frontend**: Web-based UI for workflow monitoring and debugging
- **Hatchet gRPC**: High-performance communication layer for worker coordination
- **Hatchet Controllers**: Workflow execution controllers and state management
- **Hatchet Scheduler**: Task scheduling, queueing, and distribution
- **Caddy Proxy**: Reverse proxy for service routing and load balancing

### Worker Architecture

Distributed worker pattern for scalable task processing:

- **hatchet-worker-general**: General purpose workflow execution worker
- **hatchet-worker-response-processor**: Specialized worker for response processing workflows
- Multiple worker instances for horizontal scaling and fault tolerance

### Task Management

- **packages/hatchet-tasks**: Shared task definitions and workflow specifications
- **Response API**: Dedicated API service for response handling and task dispatch
- **gRPC Communication**: Low-latency communication between workers and platform

## Integration Points

### Replacing Azure Service Bus

Hatchet workflows replace Service Bus message processing:

- **Message Processing**: Event-driven workflows instead of message triggers
- **Asynchronous Processing**: Worker-based task execution
- **Reliability**: Built-in retry logic and failure handling
- **Scalability**: Horizontal scaling of worker instances

### Redis Integration

Hatchet works alongside existing Redis infrastructure:

- **Cache Coordination**: Redis for session and cache data
- **Workflow State**: Hatchet for workflow state management
- **Performance**: Optimized Redis patterns for workflow data

### Database Integration

Workflow data management:

- **Workflow State**: Hatchet maintains workflow execution state
- **Business Data**: PostgreSQL continues to store application data
- **Coordination**: Seamless integration between workflow and business data

## Deployment Architecture

### Production Deployment

Hatchet deployed as full platform in production:

- **Kubernetes Deployment**: Complete Hatchet platform with all components
- **Resource Management**: CPU and memory limits for each component
- **High Availability**: Multiple replicas for critical components
- **gRPC Configuration**: Internal cluster communication setup

### QA Environment

Staging deployment for testing:

- **Reduced Resources**: Lower resource allocation for testing
- **Full Feature Set**: Complete Hatchet functionality for validation
- **Integration Testing**: End-to-end workflow testing capabilities

### Local Development

Simplified local setup:

- **Hatchet-lite**: Lightweight version for development
- **Single Container**: All-in-one container for simplicity
- **Local Access**: Web UI at localhost:8888, gRPC at localhost:7077
- **Development Config**: Insecure settings for local development

## Workflow Patterns

### Response Processing Workflow

Primary use case for Hatchet integration:

1. **Response Submission**: Users submit responses via frontend
2. **Task Dispatch**: Response API dispatches processing tasks to Hatchet
3. **Worker Processing**: Response processor workers handle scoring and validation
4. **Result Storage**: Processed results stored in database
5. **Notification**: Real-time updates via GraphQL subscriptions

### General Task Processing

Generic workflow execution:

1. **Task Definition**: Workflows defined in packages/hatchet-tasks
2. **Task Submission**: Various services can submit tasks to workers
3. **Worker Execution**: General workers execute tasks based on type
4. **Status Tracking**: Workflow execution status tracked by Hatchet
5. **Result Handling**: Task results processed and stored appropriately

## Configuration Management

### Environment-Specific Configuration

- **Production**: Full security and performance optimization
- **QA**: Testing-friendly configuration with debugging capabilities
- **Development**: Simplified setup with insecure local settings

### gRPC Communication

- **Production**: Secure gRPC with proper certificates
- **QA**: Cluster-internal gRPC communication
- **Development**: Insecure gRPC for local development

### Authentication Integration

- **Platform Authentication**: Hatchet platform authentication
- **Service Integration**: Worker authentication with KlickerUZH services
- **Development Mode**: Simplified authentication for local development

## Monitoring and Observability

### Workflow Monitoring

- **Hatchet Dashboard**: Real-time workflow execution monitoring
- **Task Status**: Individual task progress and completion tracking
- **Worker Health**: Worker instance health and performance metrics
- **Error Tracking**: Workflow failure detection and alerting

### Integration Monitoring

- **Service Health**: Worker service health and connectivity
- **Performance Metrics**: Task execution time and throughput
- **Resource Usage**: CPU, memory, and network utilization
- **Error Rates**: Failure rates and retry statistics

## Development Workflow

### Local Development

1. **Hatchet Startup**: Start Hatchet-lite container in docker-compose
2. **Worker Development**: Develop and test workers locally
3. **Task Testing**: Test workflow execution through Hatchet UI
4. **Integration Testing**: Validate end-to-end workflow functionality

### Deployment Process

1. **Worker Builds**: Automated Docker builds for worker services
2. **Platform Deployment**: Hatchet platform deployment to Kubernetes
3. **Configuration Updates**: Environment-specific configuration deployment
4. **Validation**: Workflow execution validation in target environment

## Migration Strategy

### Transition from Azure Service Bus

- **Parallel Operation**: Both systems running during transition
- **Gradual Migration**: Workflows moved to Hatchet incrementally
- **Fallback Capability**: Azure Service Bus maintained as fallback
- **Performance Validation**: Continuous monitoring during migration

### Future Roadmap

- **Complete Migration**: Full transition to Hatchet for all async processing
- **Enhanced Workflows**: Advanced workflow patterns using Hatchet features
- **Optimization**: Performance optimization based on production usage
- **Monitoring Enhancement**: Advanced observability and alerting

For detailed configuration and deployment specifics, refer to:

- `deploy/env-*/values-hatchet.yaml` for deployment configurations
- `docker-compose.yml` for local development setup
- `.github/workflows/v3_hatchet-*` for CI/CD workflows
- Individual worker service directories for implementation details