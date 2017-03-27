node {
   stage 'Step 1: Deploy to Integration'
        build job: 'Service Deployment/Deploy to Integration', parameters: [[$class: 'StringParameterValue', name: 'Repo', value: 'git@github-project-payment:UKForeignOffice/loi-payment-service.git'], [$class: 'StringParameterValue', name: 'Branch', value: 'Development'], [$class: 'StringParameterValue', name: 'Tag', value: 'payment-service-int'], [$class: 'StringParameterValue', name: 'Container', value: 'payment-service']]
}
